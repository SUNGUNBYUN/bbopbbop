import { supabase } from './supabase'

type StartChatParams = {
  myId: string
  myNickname: string
  otherId: string
  otherNickname: string | null
  sourceType: 'post' | 'market' | 'feed'
  sourceId: string
  sourceTitle: string | null
}

/** 채팅방을 찾거나 새로 만들고 room id를 반환 */
export async function startOrGetChat(p: StartChatParams): Promise<string | null> {
  if (p.myId === p.otherId) return null

  // 기존 방 찾기 (같은 상대 + 같은 소스)
  const { data: existing } = await supabase.from('chat_rooms').select('*')
    .or(`and(user1_id.eq.${p.myId},user2_id.eq.${p.otherId}),and(user1_id.eq.${p.otherId},user2_id.eq.${p.myId})`)

  if (existing && existing.length > 0) {
    // ⚠️ 같은 '소스(같은 제보/상품/피드)'의 방만 재사용한다.
    //    소스가 다르면(다른 상품으로 대화 시작) 새 방을 만들어야 대화가 안 섞인다.
    const sameSource = existing.find(r => r.source_type === p.sourceType && r.source_id === p.sourceId)
    if (sameSource) return sameSource.id
    // 소스 정보가 아예 없는(구버전) 방이면 재사용
    const legacyRoom = existing.find(r => !r.source_type && !r.source_id)
    if (legacyRoom) return legacyRoom.id
  }

  // 새 방 생성
  const { data: newRoom, error } = await supabase.from('chat_rooms').insert({
    user1_id: p.myId, user2_id: p.otherId,
    user1_nickname: p.myNickname, user2_nickname: p.otherNickname,
    post_id: p.sourceType === 'post' ? p.sourceId : null,
    post_title: p.sourceTitle,
    source_type: p.sourceType,
    source_id: p.sourceId,
  }).select().single()

  if (!error && newRoom) return newRoom.id
  return null
}
