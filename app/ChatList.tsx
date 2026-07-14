'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { notify } from '@/lib/social'

type ChatRoom = {
  id: string
  user1_id: string
  user2_id: string
  user1_nickname: string | null
  user2_nickname: string | null
  last_message: string | null
  last_message_at: string
  post_id: string | null
  post_title: string | null
  created_at: string
}

type Message = {
  id: string
  room_id: string
  sender_id: string
  sender_nickname: string | null
  content: string
  created_at: string
}

type User = {
  id: string
  email: string
  nickname: string
}

type Props = {
  user: User
  initialRoomId?: string | null
  onClose: () => void
}

export default function ChatList({ user, initialRoomId, onClose }: Props) {
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchRooms()
  }, [])

  const [initialOpened, setInitialOpened] = useState(false)

  useEffect(() => {
    if (initialRoomId && rooms.length > 0 && !initialOpened) {
      const room = rooms.find(r => r.id === initialRoomId)
      if (room) { openRoom(room); setInitialOpened(true) }
    }
  }, [initialRoomId, rooms, initialOpened])

  useEffect(() => {
    if (!selectedRoom) return
    const channel = supabase
      .channel(`room-${selectedRoom.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${selectedRoom.id}`
      }, (payload) => {
        const incoming = payload.new as Message
        setMessages(prev => {
          if (prev.some(m => m.id === incoming.id)) return prev
          if (incoming.sender_id === user.id) return prev
          return [...prev, incoming]
        })
        scrollToBottom()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedRoom?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function fetchRooms() {
    setLoading(true)
    const { data } = await supabase
      .from('chat_rooms')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })
    if (data) setRooms(data)
    setLoading(false)
  }

  async function openRoom(room: ChatRoom) {
    setSelectedRoom(room)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  async function handleSend() {
    if (!selectedRoom || !newMessage.trim()) return
    const content = newMessage.trim()
    setSending(true)
    setNewMessage('')

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      room_id: selectedRoom.id,
      sender_id: user.id,
      sender_nickname: user.nickname,
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMessage])
    scrollToBottom()

    const { data, error } = await supabase.from('messages').insert({
      room_id: selectedRoom.id,
      sender_id: user.id,
      sender_nickname: user.nickname,
      content
    }).select().single()

    if (!error) {
      if (data) {
        setMessages(prev => prev.map(m => m.id === tempMessage.id ? (data as Message) : m))
      }
      await supabase.from('chat_rooms').update({
        last_message: content,
        last_message_at: new Date().toISOString()
      }).eq('id', selectedRoom.id)

      const otherId = selectedRoom.user1_id === user.id ? selectedRoom.user2_id : selectedRoom.user1_id
      notify({
        userId: otherId, actorId: user.id, actorNickname: user.nickname,
        type: 'chat', targetTitle: selectedRoom.post_title ?? undefined,
      })
    } else {
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id))
      setNewMessage(content)
    }
    setSending(false)
  }

  function getOtherNickname(room: ChatRoom) {
    return room.user1_id === user.id ? (room.user2_nickname ?? '익명') : (room.user1_nickname ?? '익명')
  }

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '방금 전'
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
    return `${Math.floor(diff / 86400)}일 전`
  }

  if (selectedRoom) {
    const otherName = getOtherNickname(selectedRoom)

    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--surface)', zIndex: 200, display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
        <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => { setSelectedRoom(null); fetchRooms() }} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>←</button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>{otherName}</h2>
            {selectedRoom.post_title && (
              <p style={{ fontSize: '11px', color: 'var(--ink-4)', margin: '2px 0 0' }}>📌 {selectedRoom.post_title}</p>
            )}
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--surface-2)' }}>
          {messages.length === 0 ? (
            <p style={{ color: 'var(--ink-4)', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>첫 메시지를 보내보세요 👋</p>
          ) : (
            messages.map(msg => {
              const isMine = msg.sender_id === user.id
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '70%' }}>
                    {!isMine && (
                      <p style={{ fontSize: '11px', color: 'var(--ink-3)', margin: '0 0 3px 4px' }}>{msg.sender_nickname ?? '익명'}</p>
                    )}
                    <div style={{ padding: '10px 14px', borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', backgroundColor: isMine ? 'var(--coral)' : 'var(--surface)', color: isMine ? 'var(--surface)' : 'var(--ink)', fontSize: '14px', lineHeight: '1.5', border: isMine ? 'none' : '1px solid var(--line)' }}>
                      {msg.content}
                    </div>
                    <p style={{ fontSize: '10px', color: 'var(--ink-4)', margin: '3px 4px 0', textAlign: isMine ? 'right' : 'left' }}>{timeAgo(msg.created_at)}</p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </main>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', backgroundColor: 'var(--surface)', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="메시지를 입력하세요..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            style={{ flex: 1, padding: '10px 14px', borderRadius: '20px', border: '1.5px solid var(--line)', fontSize: '14px', outline: 'none', backgroundColor: 'var(--surface-2)' }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: newMessage.trim() ? 'var(--coral)' : 'var(--line)', color: newMessage.trim() ? 'var(--surface)' : 'var(--ink-4)', border: 'none', cursor: newMessage.trim() ? 'pointer' : 'default', fontSize: '16px' }}
          >↑</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--surface)', zIndex: 200, display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
      <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>←</button>
        <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>채팅</h2>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {loading ? (
          <p style={{ color: 'var(--ink-4)', textAlign: 'center', marginTop: '40px' }}>불러오는 중... 🔄</p>
        ) : rooms.length === 0 ? (
          <p style={{ color: 'var(--ink-4)', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>
            아직 채팅이 없어요 💬<br />
            <span style={{ fontSize: '12px' }}>제보 상세에서 채팅을 시작해보세요!</span>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rooms.map(room => {
              const otherName = getOtherNickname(room)
              return (
                <div
                  key={room.id}
                  onClick={() => openRoom(room)}
                  style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '14px', borderRadius: '12px', border: '1px solid var(--line)', cursor: 'pointer' }}
                >
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'var(--coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--surface)', fontSize: '16px', fontWeight: '700', flexShrink: 0 }}>
                    {otherName[0]}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ink)', margin: 0 }}>{otherName}</p>
                      <span style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{timeAgo(room.last_message_at)}</span>
                    </div>
                    {room.post_title && (
                      <p style={{ fontSize: '11px', color: 'var(--coral)', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📌 {room.post_title}</p>
                    )}
                    <p style={{ fontSize: '13px', color: 'var(--ink-3)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.last_message ?? '메시지가 없어요'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}