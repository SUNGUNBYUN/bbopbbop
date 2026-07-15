import { supabase } from './supabase'

/* ============================================
   포인트 (points)
   - 적립/차감은 서버 함수(RPC)로만 처리한다.
   - 클라이언트는 절대 profiles.point_balance를 직접 수정하지 않는다.
   ============================================ */

export type AwardReason = 'place_create' | 'report' | 'reverify' | 'feed'
export type SpendReason = 'spend_bump'

/** 사유별 안내용 포인트(서버 값과 일치시켜 UI에만 사용). 실제 지급은 서버가 결정 */
export const POINT_VALUES: Record<AwardReason, number> = {
  place_create: 100,
  report: 30,
  reverify: 10,
  feed: 5,
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
  return (data as number) ?? 0
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
  report: '제보 작성',
  reverify: '정보 재확인',
  feed: '자랑글 작성',
  spend_bump: '마켓 끌어올리기',
}
