'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Post, User } from '@/lib/types'
import { Logo } from '@/components/Logo'
import { IconButton, Toast } from '@/components/ui'
import { unreadCount } from '@/lib/social'
import { NotificationList } from '@/components/NotificationList'
import { Onboarding } from '@/components/Onboarding'
import { useOnboarding } from '@/lib/useOnboarding'
import { HomeTab } from '@/components/HomeTab'
import { BottomNav, FAB } from '@/components/BottomNav'
import { PostDetail } from '@/components/PostDetail'
import { PostForm } from '@/components/PostForm'
import Auth from './Auth'
import MapTab from './MapTab'
import MarketTab from './MarketTab'
import FeedTab from './FeedTab'
import ChatList from './ChatList'
import MyPage from './MyPage'

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState(0)

  // 화면 오버레이 상태
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showMyPage, setShowMyPage] = useState(false)
  const [chatRoomId, setChatRoomId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; emoji?: string } | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [unread, setUnread] = useState(0)
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding()

  useEffect(() => {
    fetchPosts()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserFromSession(session.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) setUserFromSession(session.user)
      else setUser(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  function setUserFromSession(u: any) {
    setUser({
      id: u.id,
      email: u.email ?? '',
      nickname: u.user_metadata?.nickname ?? u.email ?? '',
    })
  }

  // 안 읽은 알림 개수 (로그인 시 + 30초마다)
  useEffect(() => {
    if (!user) { setUnread(0); return }
    let alive = true
    const check = async () => { const c = await unreadCount(user.id); if (alive) setUnread(c) }
    check()
    const timer = setInterval(check, 30000)
    return () => { alive = false; clearInterval(timer) }
  }, [user, showNotifications])

  function showToast(msg: string, emoji?: string) {
    setToast({ msg, emoji })
    setTimeout(() => setToast(null), 2200)
  }

  async function fetchPosts() {
    setLoading(true)
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (data) setPosts(data)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    showToast('로그아웃 되었어요', '👋')
  }

  function requireAuth() { setShowAuth(true) }

  async function startChat() {
    if (!user || !selectedPost || !selectedPost.user_id) return
    if (selectedPost.user_id === user.id) return
    const { data: existing } = await supabase.from('chat_rooms').select('*')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${selectedPost.user_id}),and(user1_id.eq.${selectedPost.user_id},user2_id.eq.${user.id})`)
      .limit(1)
    if (existing && existing.length > 0) { setChatRoomId(existing[0].id); setShowChat(true); return }
    const { data: newRoom, error } = await supabase.from('chat_rooms').insert({
      user1_id: user.id, user2_id: selectedPost.user_id,
      user1_nickname: user.nickname, user2_nickname: selectedPost.nickname,
      post_id: selectedPost.id, post_title: selectedPost.title,
    }).select().single()
    if (!error && newRoom) { setChatRoomId(newRoom.id); setShowChat(true) }
  }

  // ===== 제보 상세 =====
  if (selectedPost) {
    return (
      <div className="app-shell">
        <PostDetail
          post={selectedPost}
          user={user}
          onBack={() => { setSelectedPost(null); fetchPosts() }}
          onRequireAuth={requireAuth}
          onOpenChat={() => { setChatRoomId(null); setShowChat(true) }}
          onStartChat={startChat}
          onDeleted={() => { setSelectedPost(null); fetchPosts(); showToast('제보가 삭제되었어요', '🗑') }}
        />
        {showChat && user && <ChatList user={user} initialRoomId={chatRoomId} onClose={() => { setShowChat(false); setChatRoomId(null) }} />}
        {showAuth && <Auth onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}
        {toast && <Toast message={toast.msg} emoji={toast.emoji} />}
      </div>
    )
  }

  // ===== 제보 작성 =====
  if (showForm && user) {
    return (
      <div className="app-shell">
        <PostForm
          user={user}
          onClose={() => setShowForm(false)}
          onSubmitted={() => { setShowForm(false); fetchPosts(); showToast('제보 완료! 고마워요', '🎉') }}
        />
      </div>
    )
  }

  // ===== 메인 =====
  return (
    <div className="app-shell">
      {/* 헤더 */}
      <header style={{
        height: 'var(--header-h)', padding: '0 16px', flexShrink: 0,
        borderBottom: '1px solid var(--line)', background: 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {user && (
            <IconButton onClick={() => setShowNotifications(true)} badge={unread} aria-label="알림">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </IconButton>
          )}
          {user && <IconButton onClick={() => { setChatRoomId(null); setShowChat(true) }}>💬</IconButton>}
          {user ? (
            <button
              onClick={() => setShowMyPage(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: 'none', borderRadius: 'var(--r-full)', padding: '6px 12px 6px 8px', cursor: 'pointer' }}
            >
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--coral)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>{user.nickname[0]}</div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-2)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.nickname}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="pressable"
              style={{ fontSize: '13px', fontWeight: 700, color: 'var(--coral)', background: 'var(--coral-soft)', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: 'var(--r-full)' }}
            >로그인</button>
          )}
        </div>
      </header>

      {/* 탭 콘텐츠 */}
      {activeTab === 0 && (
        <HomeTab
          posts={posts}
          loading={loading}
          onSelectPost={setSelectedPost}
          onNewPost={() => { if (!user) { requireAuth(); return }; setShowForm(true) }}
        />
      )}
      {activeTab === 1 && <MapTab onSelectPost={(p) => setSelectedPost(p as Post)} />}
      {activeTab === 2 && <MarketTab user={user} onRequireAuth={requireAuth} />}
      {activeTab === 3 && <FeedTab user={user} onRequireAuth={requireAuth} />}

      {/* FAB — 제보 탭에서만 */}
      {activeTab === 0 && <FAB onClick={() => { if (!user) { requireAuth(); return }; setShowForm(true) }} />}

      {/* 하단 네비 */}
      <BottomNav active={activeTab} onChange={setActiveTab} />

      {/* 오버레이 */}
      {showChat && user && <ChatList user={user} initialRoomId={chatRoomId} onClose={() => { setShowChat(false); setChatRoomId(null) }} />}
      {showMyPage && user && <MyPage user={user} onClose={() => setShowMyPage(false)} onSelectPost={(p) => { setShowMyPage(false); setSelectedPost(p) }} />}
      {showNotifications && user && (
        <NotificationList
          user={user}
          onClose={() => setShowNotifications(false)}
          onSelectTarget={async (type, id) => {
            setShowNotifications(false)
            if (type === 'post') {
              const { data } = await supabase.from('posts').select('*').eq('id', id).single()
              if (data) setSelectedPost(data)
            } else if (type === 'market') {
              setActiveTab(2)
            } else if (type === 'feed') {
              setActiveTab(3)
            }
          }}
        />
      )}
      {showAuth && <Auth onClose={() => setShowAuth(false)} onSuccess={() => { setShowAuth(false); showToast('환영해요!', '🎉') }} />}
      {toast && <Toast message={toast.msg} emoji={toast.emoji} />}
      {showOnboarding && <Onboarding onDone={dismissOnboarding} />}
    </div>
  )
}
