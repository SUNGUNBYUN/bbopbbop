'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Post = {
  id: string
  title: string
  location: string | null
  image_url: string | null
  created_at: string
  view_count: number
  like_count: number
  comment_count: number
}

type MarketItem = {
  id: string
  title: string
  price: number | null
  is_free: boolean
  image_url: string | null
  status: string
  created_at: string
  like_count: number
}

type FeedPost = {
  id: string
  content: string | null
  image_url: string | null
  like_count: number
  comment_count: number
  created_at: string
}

type User = {
  id: string
  email: string
  nickname: string
}

type Props = {
  user: User
  onClose: () => void
  onSelectPost: (post: any) => void
}

export default function MyPage({ user, onClose, onSelectPost }: Props) {
  const [activeSection, setActiveSection] = useState<'posts' | 'market' | 'feed' | 'liked'>('posts')
  const [myPosts, setMyPosts] = useState<Post[]>([])
  const [myMarket, setMyMarket] = useState<MarketItem[]>([])
  const [myFeed, setMyFeed] = useState<FeedPost[]>([])
  const [likedPosts, setLikedPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [activeSection])

  async function fetchData() {
    setLoading(true)

    if (activeSection === 'posts') {
      const { data } = await supabase
        .from('posts').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setMyPosts(data)
    }

    if (activeSection === 'market') {
      const { data } = await supabase
        .from('market_items').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setMyMarket(data)
    }

    if (activeSection === 'feed') {
      const { data } = await supabase
        .from('feed_posts').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setMyFeed(data)
    }

    if (activeSection === 'liked') {
      const { data: likeData } = await supabase
        .from('likes').select('post_id')
        .eq('user_id', user.id)
      if (likeData && likeData.length > 0) {
        const postIds = likeData.map(l => l.post_id)
        const { data: postsData } = await supabase
          .from('posts').select('*')
          .in('id', postIds)
          .order('created_at', { ascending: false })
        if (postsData) setLikedPosts(postsData)
      } else {
        setLikedPosts([])
      }
    }

    setLoading(false)
  }

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '방금 전'
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
    return `${Math.floor(diff / 86400)}일 전`
  }

  function priceText(item: MarketItem) {
    if (item.is_free) return '나눔'
    return `${(item.price ?? 0).toLocaleString()}원`
  }

  function statusBadge(status: string) {
    if (status === 'reserved') return { text: '예약중', color: '#F49719' }
    if (status === 'sold') return { text: '거래완료', color: '#888' }
    return { text: '판매중', color: '#FF6B6B' }
  }

  const sections = [
    { key: 'posts' as const, label: '내 제보', icon: '🔍' },
    { key: 'market' as const, label: '내 마켓', icon: '🛍️' },
    { key: 'feed' as const, label: '내 피드', icon: '📸' },
    { key: 'liked' as const, label: '좋아요', icon: '❤️' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 200, display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
      {/* 헤더 */}
      <header style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>←</button>
        <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>마이페이지</h2>
      </header>

      {/* 프로필 */}
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#FF6B6B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', fontWeight: '700', flexShrink: 0 }}>
          {user.nickname[0]}
        </div>
        <div>
          <p style={{ fontSize: '17px', fontWeight: '700', color: '#222', margin: '0 0 3px' }}>{user.nickname}</p>
          <p style={{ fontSize: '13px', color: '#aaa', margin: 0 }}>{user.email}</p>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            style={{ flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', borderBottom: activeSection === s.key ? '2px solid #FF6B6B' : '2px solid transparent', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '16px' }}>{s.icon}</span>
            <span style={{ fontSize: '11px', color: activeSection === s.key ? '#FF6B6B' : '#888', fontWeight: activeSection === s.key ? '700' : '400' }}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {loading ? (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>불러오는 중... 🔄</p>
        ) : (
          <>
            {/* 내 제보 */}
            {activeSection === 'posts' && (
              myPosts.length === 0 ? (
                <p style={{ color: '#bbb', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>아직 올린 제보가 없어요 🔍</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myPosts.map(post => (
                    <div key={post.id} onClick={() => { onClose(); onSelectPost(post) }} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '12px', border: '1px solid #f0f0f0', cursor: 'pointer' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '10px', backgroundColor: '#fafafa', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {post.image_url ? (
                          <img src={post.image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '24px' }}>🧸</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#222', margin: '0 0 4px' }}>{post.title}</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#bbb' }}>👁️ {post.view_count ?? 0}</span>
                          <span style={{ fontSize: '11px', color: '#bbb' }}>❤️ {post.like_count ?? 0}</span>
                          <span style={{ fontSize: '11px', color: '#bbb' }}>💬 {post.comment_count ?? 0}</span>
                          <span style={{ fontSize: '11px', color: '#bbb' }}>{timeAgo(post.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 내 마켓 */}
            {activeSection === 'market' && (
              myMarket.length === 0 ? (
                <p style={{ color: '#bbb', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>아직 올린 상품이 없어요 🛍️</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {myMarket.map(item => {
                    const badge = statusBadge(item.status)
                    return (
                      <div key={item.id} style={{ borderRadius: '14px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                        <div style={{ width: '100%', height: '100px', backgroundColor: '#fafafa', position: 'relative' }}>
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🧸</div>
                          )}
                          <div style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '10px', fontWeight: '700', color: badge.color, backgroundColor: '#fff', padding: '2px 6px', borderRadius: '8px' }}>{badge.text}</div>
                        </div>
                        <div style={{ padding: '8px 10px' }}>
                          <p style={{ fontSize: '12px', fontWeight: '600', color: '#222', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                          <p style={{ fontSize: '12px', fontWeight: '800', color: item.is_free ? '#27500A' : '#222', margin: 0 }}>{priceText(item)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* 내 피드 */}
            {activeSection === 'feed' && (
              myFeed.length === 0 ? (
                <p style={{ color: '#bbb', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>아직 올린 자랑글이 없어요 📸</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px' }}>
                  {myFeed.map(feed => (
                    <div key={feed.id} style={{ aspectRatio: '1', backgroundColor: '#fafafa', overflow: 'hidden', position: 'relative' }}>
                      {feed.image_url ? (
                        <img src={feed.image_url} alt="피드" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#bbb', padding: '8px', textAlign: 'center' }}>
                          {(feed.content ?? '').slice(0, 30)}
                        </div>
                      )}
                      <div style={{ position: 'absolute', bottom: '4px', right: '4px', display: 'flex', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px' }}>❤️ {feed.like_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* 좋아요한 제보 */}
            {activeSection === 'liked' && (
              likedPosts.length === 0 ? (
                <p style={{ color: '#bbb', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>아직 좋아요한 제보가 없어요 ❤️</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {likedPosts.map(post => (
                    <div key={post.id} onClick={() => { onClose(); onSelectPost(post) }} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '12px', border: '1px solid #f0f0f0', cursor: 'pointer' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '10px', backgroundColor: '#fafafa', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {post.image_url ? (
                          <img src={post.image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '24px' }}>🧸</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#222', margin: '0 0 4px' }}>{post.title}</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#bbb' }}>👁️ {post.view_count ?? 0}</span>
                          <span style={{ fontSize: '11px', color: '#bbb' }}>❤️ {post.like_count ?? 0}</span>
                          <span style={{ fontSize: '11px', color: '#bbb' }}>💬 {post.comment_count ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </main>
    </div>
  )
}