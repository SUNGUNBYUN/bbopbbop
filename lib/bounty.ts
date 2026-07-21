import { supabase } from './supabase'
import { notifyPointsChanged } from './points'

/* ============================================
   제보 현상금
   - 포인트를 걸고 "이거 어디 있나요?" 요청
   - 답변을 채택하면 걸어둔 포인트가 답변자에게 지급
   - 취소·기간만료 시 자동 환불
   - 포인트 이동은 전부 서버 함수(RPC)로만 처리
   ============================================ */

export const MIN_REWARD = 10
export const MAX_REWARD = 5000
export const DEFAULT_REWARD = 50
export const DEFAULT_DAYS = 7

export type BountyStatus = 'open' | 'resolved' | 'canceled' | 'expired'

export type Bounty = {
  id: string
  user_id: string
  nickname: string | null
  title: string
  description: string | null
  place_name: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  reward: number
  status: BountyStatus
  winner_user_id: string | null
  winner_answer_id: string | null
  answer_count: number
  expires_at: string
  created_at: string
  resolved_at: string | null
}

export type BountyAnswer = {
  id: string
  bounty_id: string
  user_id: string
  nickname: string | null
  post_id: string | null
  comment: string | null
  created_at: string
}

/** 기간이 지난 현상금 자동 환불 (앱 진입 시 가볍게 호출) */
export async function expireBounties(): Promise<void> {
  try {
    await supabase.rpc('expire_bounties')
  } catch {
    // 실패해도 사용자 흐름을 막지 않음
  }
}

/** 현상금 목록 */
export async function listBounties(status: BountyStatus | 'all' = 'open'): Promise<Bounty[]> {
  let q = supabase.from('bounties').select('*')
  if (status !== 'all') q = q.eq('status', status)
  const { data } = await q.order('created_at', { ascending: false }).limit(100)
  return (data as Bounty[]) ?? []
}

/** 내가 건 현상금 */
export async function myBounties(userId: string): Promise<Bounty[]> {
  const { data } = await supabase
    .from('bounties').select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data as Bounty[]) ?? []
}

/** 현상금 하나 */
export async function getBounty(id: string): Promise<Bounty | null> {
  const { data } = await supabase.from('bounties').select('*').eq('id', id).single()
  return (data as Bounty) ?? null
}

/** 답변 목록 */
export async function getAnswers(bountyId: string): Promise<BountyAnswer[]> {
  const { data } = await supabase
    .from('bounty_answers').select('*')
    .eq('bounty_id', bountyId)
    .order('created_at', { ascending: true })
  return (data as BountyAnswer[]) ?? []
}

/** 현상금 등록 (포인트 즉시 차감 = 묶어둠) */
export async function createBounty(args: {
  title: string
  description?: string
  placeName?: string | null
  location?: string | null
  lat?: number | null
  lng?: number | null
  reward: number
  days?: number
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_bounty', {
    p_title: args.title,
    p_description: args.description ?? null,
    p_place_name: args.placeName ?? null,
    p_location: args.location ?? null,
    p_lat: args.lat ?? null,
    p_lng: args.lng ?? null,
    p_reward: args.reward,
    p_days: args.days ?? DEFAULT_DAYS,
  })
  if (error) throw new Error(error.message || '현상금 등록에 실패했어요')
  notifyPointsChanged()
  return data as string
}

/** 답변 달기 (제보 글 연결 또는 내용) */
export async function answerBounty(bountyId: string, postId?: string | null, comment?: string): Promise<string> {
  const { data, error } = await supabase.rpc('answer_bounty', {
    p_bounty_id: bountyId,
    p_post_id: postId ?? null,
    p_comment: comment ?? null,
  })
  if (error) throw new Error(error.message || '답변 등록에 실패했어요')
  return data as string
}

/** 채택 → 현상금 지급 */
export async function resolveBounty(bountyId: string, answerId: string): Promise<number> {
  const { data, error } = await supabase.rpc('resolve_bounty', {
    p_bounty_id: bountyId,
    p_answer_id: answerId,
  })
  if (error) throw new Error(error.message || '채택에 실패했어요')
  notifyPointsChanged()
  return (data as number) ?? 0
}

/** 취소 → 환불 (답변 없을 때만) */
export async function cancelBounty(bountyId: string): Promise<number> {
  const { data, error } = await supabase.rpc('cancel_bounty', { p_bounty_id: bountyId })
  if (error) throw new Error(error.message || '취소에 실패했어요')
  notifyPointsChanged()
  return (data as number) ?? 0
}

/** 남은 기간 표시용 */
export function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

export const BOUNTY_STATUS_LABEL: Record<BountyStatus, { text: string; color: string; bg: string }> = {
  open:     { text: '찾는 중',  color: 'var(--coral)',   bg: 'var(--coral-soft)' },
  resolved: { text: '채택 완료', color: 'var(--success)', bg: 'var(--mint-soft)' },
  canceled: { text: '취소됨',   color: 'var(--ink-4)',   bg: 'var(--surface-2)' },
  expired:  { text: '기간 만료', color: 'var(--ink-4)',   bg: 'var(--surface-2)' },
}
