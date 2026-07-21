import { supabase } from './supabase'

/* ============================================
   포인트 (points)
   - 적립/차감은 서버 함수(RPC)로만 처리한다.
   - 클라이언트는 절대 profiles.point_balance를 직접 수정하지 않는다.
   ============================================ */

export type AwardReason = 'place_create' | 'report' | 'reverify' | 'feed'
export type SpendReason = 'spend_bump' | 'spend_pin' | 'spend_highlight' | 'spend_bounty'

/**
 * 안내용 포인트 표 (서버 값과 일치시켜 UI 표시에만 사용).
 * 실제 지급은 항상 서버가 결정합니다.
 */
export const POINTS = {
  /** 새 가게를 처음 등록할 때 즉시 */
  placeCreate: 20,
  /** 그 가게가 다른 사람에게 처음 확인받으면 추가 */
  placeConfirmed: 80,
  /** 상품 제보 즉시 (중복이면 0) */
  report: 10,
  /** 그 제보가 처음 확인받으면 추가 */
  reportConfirmed: 40,
  /** 남의 제보를 확인해줄 때 (하루 10건까지) */
  verify: 10,
  /** 자랑글 (하루 3개까지) */
  feed: 5,
} as const

/** 하위 호환용 */
export const POINT_VALUES: Record<AwardReason, number> = {
  place_create: POINTS.placeCreate,
  report: POINTS.report,
  reverify: POINTS.verify,
  feed: POINTS.feed,
}

/**
 * 포인트가 변했다고 앱에 알림.
 * 헤더 잔액처럼 여러 화면에서 보고 있는 값을 즉시 갱신하기 위한 신호.
 * 포인트를 바꾸는 함수들이 스스로 호출하므로 호출부에서 신경 쓸 필요가 없어요.
 */
export const POINTS_CHANGED_EVENT = 'bbop:points-changed'

export function notifyPointsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(POINTS_CHANGED_EVENT))
  }
}

/** 내 포인트 잔액 */
export async function getBalance(userId: string): Promise<number> {
  const { data } = await supabase.from('profiles').select('point_balance').eq('id', userId).single()
  return data?.point_balance ?? 0
}

/**
 * 포인트 적립. 서버가 상한/쿨다운/중복을 판단해 '실제 지급된' 포인트를 반환.
 * 0이면 (상한 초과·쿨다운 등으로) 지급되지 않은 것.
 */
export async function awardPoints(reason: AwardReason, refType?: string, refId?: string): Promise<number> {
  const { data, error } = await supabase.rpc('award_points', {
    p_reason: reason,
    p_ref_type: refType ?? null,
    p_ref_id: refId ?? null,
  })
  if (error) { console.error('awardPoints', error); return 0 }
  const amount = (data as number) ?? 0
  if (amount > 0) notifyPointsChanged()
  return amount
}

/**
 * 마켓 끌어올리기. 성공 시 새 bumped_at(ISO) 반환, 실패 시 에러 메시지 throw.
 * 포인트 차감·쿨다운·소유권 검증을 서버가 한 트랜잭션으로 처리.
 */
export async function bumpMarketItem(itemId: string, cost: number): Promise<string> {
  const { data, error } = await supabase.rpc('bump_market_item', {
    p_item_id: itemId,
    p_cost: cost,
  })
  if (error) throw new Error(error.message || '끌어올리기에 실패했어요')
  notifyPointsChanged()
  return data as string
}

/** 최근 포인트 내역 (마이페이지용) */
export type LedgerRow = { id: string; amount: number; reason: string; created_at: string }
export async function getLedger(userId: string, limit = 30): Promise<LedgerRow[]> {
  const { data } = await supabase
    .from('points_ledger')
    .select('id, amount, reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

/** 사유 → 한글 라벨 (내역 표시용) */
export const REASON_LABELS: Record<string, string> = {
  place_create: '가게 첫 등록',
  place_confirmed: '가게 등록 확정',
  report: '상품 제보',
  product_report: '상품 제보',
  product_confirmed: '제보 확정 보상',
  reverify: '정보 재확인',
  feed: '자랑글 작성',
  spend_bump: '마켓 끌어올리기',
  spend_pin: '마켓 상단 고정',
  spend_highlight: '마켓 강조',
  spend_bounty: '현상금 걸기',
  bounty_reward: '현상금 획득',
  bounty_refund: '현상금 환불',
}

/* ============================================
   Phase 2: 중복 감지 + 조건부 지급 + 재인증
   ============================================ */

export type NearbyPlace = {
  id: string
  place_name: string
  address: string | null
  latitude: number
  longitude: number
  product_count: number
  distance_m: number
}

/** 등록 전 근처 중복 후보 조회 (반경 ~50m + kakao_place_id) */
export async function findNearbyPlaces(lat: number, lng: number, kakaoId?: string, name?: string): Promise<NearbyPlace[]> {
  const { data, error } = await supabase.rpc('find_nearby_places', {
    p_lat: lat, p_lng: lng, p_kakao_id: kakaoId ?? null, p_name: name ?? null,
  })
  if (error) { console.error('findNearbyPlaces', error); return [] }
  return (data as NearbyPlace[]) ?? []
}

export type PlaceResult = { place_id: string; place_reward: number; is_new_place: boolean }

/**
 * 가게 확보(get-or-create). existingPlaceId를 주면 그 가게 사용(상품 추가),
 * 없으면 신규 가게 생성 + 즉시 20P(가게 확정 80P는 확인 시).
 */
export async function getOrCreatePlace(args: {
  placeName: string; address?: string | null; lat: number; lng: number
  kakaoId?: string | null; existingPlaceId?: string | null
}): Promise<PlaceResult | null> {
  const { data, error } = await supabase.rpc('get_or_create_place', {
    p_place_name: args.placeName,
    p_address: args.address ?? null,
    p_lat: args.lat, p_lng: args.lng,
    p_kakao_id: args.kakaoId ?? null,
    p_existing_place_id: args.existingPlaceId ?? null,
  })
  if (error) { console.error('getOrCreatePlace', error); return null }
  const result = data as PlaceResult
  if (result?.place_reward > 0) notifyPointsChanged()
  return result
}

export type ProductResult = { post_reward: number; is_dup: boolean }

/**
 * 상품 제보 보상. posts insert 후 호출.
 * 같은 가게+같은 상품이 7일 이내면 중복(0P), 아니면 즉시 10P(확정 40P는 확인 시).
 */
export async function awardProductReport(postId: string, placeId: string, title: string, force = false): Promise<ProductResult | null> {
  const { data, error } = await supabase.rpc('award_product_report', {
    p_post_id: postId, p_place_id: placeId, p_title: title, p_force: force,
  })
  if (error) { console.error('awardProductReport', error); return null }
  const result = data as ProductResult
  if (result?.post_reward > 0) notifyPointsChanged()
  return result
}

export type SimilarProduct = { id: string; title: string; image_url: string | null; created_at: string }

/** 입력한 상품명과 비슷한 기존 상품(사진 포함) — 유저 판단용 팝업에 사용 */
export async function similarProducts(placeId: string, title: string): Promise<SimilarProduct[]> {
  const { data, error } = await supabase.rpc('similar_products', { p_place_id: placeId, p_title: title })
  if (error) { console.error('similarProducts', error); return [] }
  return (data as SimilarProduct[]) ?? []
}

export type VerifyResult = { my_reward: number; owner_confirmed: number; place_confirmed?: number; verify_count?: number; already?: boolean }

/** "진짜 있어요" 확인. 확인해준 사람 +10P, 미확정 제보면 작성자 +40P, 가게 등록자 +80P. */
export async function verifyPost(postId: string): Promise<VerifyResult | null> {
  const { data, error } = await supabase.rpc('verify_post', { p_post_id: postId })
  if (error) throw new Error(error.message || '확인에 실패했어요')
  const result = data as VerifyResult
  if (result?.my_reward > 0) notifyPointsChanged()
  return result
}


export type PlaceProduct = { id: string; title: string; image_url: string | null; created_at: string }

/** 가게의 기존 상품 목록(등록 전 유저에게 보여줌) */
export async function placeProducts(placeId: string): Promise<PlaceProduct[]> {
  const { data, error } = await supabase.rpc('place_products', { p_place_id: placeId })
  if (error) { console.error('placeProducts', error); return [] }
  return (data as PlaceProduct[]) ?? []
}

/** 카카오 카테고리로 인형뽑기/오락 업종인지 추정 (경고용, 완전판별 아님) */
export function looksLikeClawMachine(categoryName?: string): boolean {
  if (!categoryName) return true // 정보 없으면 경고 안 띄움(오탐 방지)
  const kw = ['오락', '게임', '인형', '뽑기', '락커', '문화', '놀이', 'PC방', '노래']
  return kw.some(k => categoryName.includes(k))
}


/* ============================================
   등급 (누적 적립 포인트 기준)
   - 포인트를 써도 등급은 내려가지 않아요.
   ============================================ */

export type Level = {
  key: string
  name: string
  emoji: string
  min: number
  color: string
  bg: string
}

/**
 * 등급 문턱.
 * 기준: 상품 제보 1건 확정 = 50P, 새 가게 1곳 확정 = 100P.
 *  · 뽑친구  200P  → 제보 4건 정도. 첫 주 안에 도달하는 게 목표
 *  · 뽑고수  800P  → 한 달쯤 꾸준히
 *  · 뽑마스터 2500P → 3~4개월
 *  · 뽑신    7000P → 1년 가까이. 소수만
 *
 * 나중에 낮추는 건 안전하지만(등급이 올라감) 올리면 기존 유저가 강등되니 주의.
 */
export const LEVELS: Level[] = [
  { key: 'seed',   name: '뽑린이',   emoji: '🌱', min: 0,    color: 'var(--ink-3)',   bg: 'var(--surface-2)' },
  { key: 'friend', name: '뽑친구',   emoji: '🧸', min: 200,  color: 'var(--coral)',   bg: 'var(--coral-soft)' },
  { key: 'pro',    name: '뽑고수',   emoji: '⭐', min: 800,  color: 'var(--warning)', bg: 'var(--butter-soft)' },
  { key: 'master', name: '뽑마스터', emoji: '👑', min: 2500, color: 'var(--success)', bg: 'var(--mint-soft)' },
  { key: 'god',    name: '뽑신',     emoji: '🏆', min: 7000, color: '#fff',           bg: 'var(--coral)' },
]

/** 누적 적립 포인트 → 현재 등급 */
export function levelOf(totalEarned: number): Level {
  let current = LEVELS[0]
  for (const lv of LEVELS) {
    if (totalEarned >= lv.min) current = lv
  }
  return current
}

/** 다음 등급까지 남은 포인트 (최고 등급이면 next=null) */
export function nextLevelOf(totalEarned: number): { next: Level | null; remain: number; progress: number } {
  const current = levelOf(totalEarned)
  const idx = LEVELS.findIndex(l => l.key === current.key)
  const next = idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null
  if (!next) return { next: null, remain: 0, progress: 1 }
  const span = next.min - current.min
  const done = totalEarned - current.min
  return {
    next,
    remain: Math.max(0, next.min - totalEarned),
    progress: span > 0 ? Math.min(1, done / span) : 1,
  }
}

/** 내 누적 적립 포인트 */
export async function getTotalEarned(userId: string): Promise<number> {
  const { data } = await supabase.from('profiles').select('total_earned').eq('id', userId).single()
  return data?.total_earned ?? 0
}

/** 여러 유저의 등급을 한 번에 (목록에서 작성자 뱃지 표시용) */
export async function getLevels(userIds: string[]): Promise<Record<string, Level>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return {}
  const { data } = await supabase.from('profiles').select('id, total_earned').in('id', ids)
  const map: Record<string, Level> = {}
  for (const row of data ?? []) {
    map[(row as any).id] = levelOf((row as any).total_earned ?? 0)
  }
  return map
}


/* ============================================
   마켓 노출 강화
   ============================================ */

export const PIN_COST = 100        // 상단 고정 24시간
export const HIGHLIGHT_COST = 50   // 강조 테두리 24시간

export type BoostKind = 'pin' | 'highlight'

/** 상단 고정 / 강조 구매. 성공 시 만료 시각(ISO) 반환 */
export async function boostMarketItem(itemId: string, kind: BoostKind): Promise<string> {
  const cost = kind === 'pin' ? PIN_COST : HIGHLIGHT_COST
  const { data, error } = await supabase.rpc('boost_market_item', {
    p_item_id: itemId,
    p_kind: kind,
    p_cost: cost,
  })
  if (error) throw new Error(error.message || '설정에 실패했어요')
  notifyPointsChanged()
  return data as string
}

/** 아직 유효한지 */
export function isActive(until: string | null | undefined): boolean {
  if (!until) return false
  return new Date(until).getTime() > Date.now()
}
