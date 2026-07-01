import { supabase } from './supabase'

/* ============================================
   알림 (notifications)
   ============================================ */

type NotifyParams = {
  userId: string           // 받는 사람
  actorId: string          // 유발한 사람
  actorNickname: string
  type: 'like' | 'comment' | 'chat' | 'market_like' | 'feed_like' | 'feed_comment'
  targetType?: 'post' | 'market' | 'feed'
  targetId?: string
  targetTitle?: string
}

const TYPE_MESSAGES: Record<NotifyParams['type'], string> = {
  like: '님이 회원님의 제보를 좋아해요 ❤️',
  comment: '님이 회원님의 제보에 댓글을 남겼어요 💬',
  chat: '님이 채팅을 보냈어요 📩',
  market_like: '님이 회원님의 상품을 찜했어요 🧡',
  feed_like: '님이 회원님의 자랑글을 좋아해요 ❤️',
  feed_comment: '님이 회원님의 자랑글에 댓글을 남겼어요 💬',
}

/** 알림 생성 (본인에겐 안 보냄) */
export async function notify(p: NotifyParams) {
  if (p.userId === p.actorId) return // 자기 자신 알림 방지
  await supabase.from('notifications').insert({
    user_id: p.userId,
    actor_id: p.actorId,
    actor_nickname: p.actorNickname,
    type: p.type,
    target_type: p.targetType,
    target_id: p.targetId,
    target_title: p.targetTitle,
    message: `${p.actorNickname}${TYPE_MESSAGES[p.type]}`,
  })
}

/** 안 읽은 알림 개수 */
export async function unreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  return count ?? 0
}

/** 모두 읽음 처리 */
export async function markAllRead(userId: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
}

/* ============================================
   신고 (reports)
   ============================================ */

export const REPORT_REASONS = ['스팸/광고', '욕설/비방', '부적절한 콘텐츠', '사기 의심', '기타'] as const

export async function reportContent(params: {
  reporterId: string
  targetType: 'post' | 'market' | 'feed' | 'comment' | 'user'
  targetId: string
  reason: string
  detail?: string
}) {
  return supabase.from('reports').insert({
    reporter_id: params.reporterId,
    target_type: params.targetType,
    target_id: params.targetId,
    reason: params.reason,
    detail: params.detail,
  })
}

/* ============================================
   차단 (blocks)
   ============================================ */

export async function blockUser(blockerId: string, blockedId: string) {
  return supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId })
}

export async function unblockUser(blockerId: string, blockedId: string) {
  return supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId)
}

/** 내가 차단한 사용자 ID 목록 */
export async function getBlockedIds(userId: string): Promise<string[]> {
  const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', userId)
  return data?.map(b => b.blocked_id) ?? []
}
