'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { markAllRead } from '@/lib/social'
import { Header, BackButton, Avatar, EmptyState, Spinner } from './ui'

type Notification = {
  id: string
  actor_id: string | null
  actor_nickname: string | null
  type: string
  target_type: string | null
  target_id: string | null
  target_title: string | null
  message: string | null
  is_read: boolean
  created_at: string
}

type Props = {
  user: User
  onClose: () => void
  onSelectTarget: (targetType: string, targetId: string) => void
}

export function NotificationList({ user, onClose, onSelectTarget }: Props) {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [])

  async function fetchNotifications() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setItems(data)
    await markAllRead(user.id)
    setLoading(false)
  }

  async function clearAll() {
    if (!confirm('알림을 모두 지울까요?')) return
    await supabase.from('notifications').delete().eq('user_id', user.id)
    setItems([])
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, maxWidth: 'var(--app-max)', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <Header
        left={<BackButton onClick={onClose} />}
        title="알림"
        right={items.length > 0 ? (
          <button onClick={clearAll} style={{ fontSize: '12.5px', color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', fontWeight: 600 }}>모두 지우기</button>
        ) : undefined}
      />

      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Spinner label="알림 불러오는 중..." />
        ) : items.length === 0 ? (
          <EmptyState emoji="🔔" title="아직 알림이 없어요" desc="좋아요, 댓글, 채팅이 오면 여기로 알려드릴게요" />
        ) : (
          items.map(n => (
            <button
              key={n.id}
              onClick={() => { if (n.target_type && n.target_id) onSelectTarget(n.target_type, n.target_id) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '15px 18px', border: 'none', borderBottom: '1px solid var(--line)',
                background: n.is_read ? 'transparent' : 'var(--coral-soft)',
                cursor: n.target_id ? 'pointer' : 'default', textAlign: 'left',
              }}
            >
              <Avatar name={n.actor_nickname} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', color: 'var(--ink)', margin: '0 0 3px', lineHeight: 1.4 }}>
                  <b>{n.actor_nickname ?? '누군가'}</b>
                  <span style={{ color: 'var(--ink-2)' }}>{(n.message ?? '').replace(n.actor_nickname ?? '', '')}</span>
                </p>
                {n.target_title && (
                  <p style={{ fontSize: '12px', color: 'var(--ink-4)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“{n.target_title}”</p>
                )}
                <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: '3px 0 0' }}>{timeAgo(n.created_at)}</p>
              </div>
              {!n.is_read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--coral)', flexShrink: 0 }} />}
            </button>
          ))
        )}
      </main>
    </div>
  )
}
