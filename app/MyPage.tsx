'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/types'
import { timeAgo, formatPrice, marketStatus } from '@/lib/utils'
import { Header, BackButton, Button, EmptyState, Spinner, Stat } from '@/components/ui'

type Post = { id: string; title: string; location: string | null; image_url: string | null; created_at: string; view_count: number; like_count: number; comment_count: number }
type MarketItem = { id: string; title: string; price: number | null; is_free: boolean; image_url: string | null; status: string; created_at: string; like_count: number }
type FeedPost = { id: string; content: string | null; image_url: string | null; like_count: number; comment_count: number; created_at: string }

type Props = { user: User; onClose: () => void; onSelectPost: (post: any) => void }

export default function MyPage({ user, onClose, onSelectPost }: Props) {
  const [section, setSection] = useState<'posts' | 'market' | 'feed' | 'liked'>('posts')
  const [myPosts, setMyPosts] = useState<Post[]>([])
  const [myMarket, setMyMarket] = useState<MarketItem[]>([])
  const [myFeed, setMyFeed] = useState<FeedPost[]>([])
  const [likedPosts, setLikedPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ posts: 0, market: 0, feed: 0 })

  useEffect(() => { fetchData() }, [section])
  useEffect(() => { fetchCounts() }, [])

  async function fetchCounts() {
    const [p, m, f] = await Promise.all([
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('market_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('feed_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])
    setCounts({ posts: p.count ?? 0, market: m.count ?? 0, feed: f.count ?? 0 })
  }

  async function fetchData() {
    setLoading(true)
    if (section === 'posts') {
      const { data } = await supabase.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (data) setMyPosts(data)
    } else if (section === 'market') {
      const { data } = await supabase.from('market_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (data) setMyMarket(data)
    } else if (section === 'feed') {
      const { data } = await supabase.from('feed_posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (data) setMyFeed(data)
    } else if (section === 'liked') {
      const { data: likeData } = await supabase.from('likes').select('post_id').eq('user_id', user.id)
      if (likeData && likeData.length > 0) {
        const ids = likeData.map(l => l.post_id)
        const { data: posts } = await supabase.from('posts').select('*').in('id', ids).order('created_at', { ascending: false })
        if (posts) setLikedPosts(posts)
      } else setLikedPosts([])
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    onClose()
  }

  const sections = [
    { key: 'posts' as const, label: '내 제보', icon: '🔍' },
    { key: 'market' as const, label: '내 마켓', icon: '🛍️' },
    { key: 'feed' as const, label: '내 피드', icon: '📸' },
    { key: 'liked' as const, label: '좋아요', icon: '❤️' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, maxWidth: 'var(--app-max)', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <Header left={<BackButton onClick={onClose} />} title="마이페이지" />

      {/* 프로필 카드 */}
      <div style={{ padding: '20px 20px 22px', background: 'linear-gradient(135deg, var(--coral) 0%, var(--coral-dark) 100%)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 800, flexShrink: 0, fontFamily: 'var(--font-display)', backdropFilter: 'blur(4px)' }}>{user.nickname[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '19px', fontWeight: 800, margin: '0 0 3px' }}>{user.nickname}</p>
            <p style={{ fontSize: '12.5px', opacity: 0.85, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
          </div>
        </div>
        {/* 통계 */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          {[{ n: counts.posts, l: '제보' }, { n: counts.market, l: '마켓' }, { n: counts.feed, l: '피드' }].map(s => (
            <div key={s.l} style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-md)', padding: '10px', textAlign: 'center', backdropFilter: 'blur(4px)' }}>
              <p style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 2px' }}>{s.n}</p>
              <p style={{ fontSize: '11.5px', opacity: 0.85, margin: 0 }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', background: 'var(--surface)', flexShrink: 0 }}>
        {sections.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)} style={{ flex: 1, padding: '13px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', borderBottom: section === s.key ? '2px solid var(--coral)' : '2px solid transparent', cursor: 'pointer', marginBottom: '-1px' }}>
            <span style={{ fontSize: '16px', filter: section === s.key ? 'none' : 'grayscale(0.5) opacity(0.6)' }}>{s.icon}</span>
            <span style={{ fontSize: '11px', color: section === s.key ? 'var(--coral)' : 'var(--ink-4)', fontWeight: section === s.key ? 700 : 500 }}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {loading ? <Spinner /> : (
          <>
            {section === 'posts' && (
              myPosts.length === 0 ? <EmptyState emoji="🔍" title="아직 올린 제보가 없어요" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myPosts.map(post => (
                    <div key={post.id} onClick={() => { onClose(); onSelectPost(post) }} className="pressable" style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: 'var(--r-md)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}>
                      <div style={{ width: '58px', height: '58px', borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {post.image_url ? <img src={post.image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '24px' }}>🧸</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</p>
                        <div style={{ display: 'flex', gap: '9px' }}>
                          <Stat icon="👁" value={post.view_count ?? 0} />
                          <Stat icon="❤️" value={post.like_count ?? 0} />
                          <Stat icon="💬" value={post.comment_count ?? 0} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {section === 'market' && (
              myMarket.length === 0 ? <EmptyState emoji="🛍️" title="아직 올린 상품이 없어요" /> : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {myMarket.map(item => {
                    const badge = marketStatus(item.status)
                    return (
                      <div key={item.id} style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ width: '100%', aspectRatio: '1', background: 'var(--surface-2)', position: 'relative' }}>
                          {item.image_url ? <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>🧸</div>}
                          <div style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '10px', fontWeight: 700, color: badge.color, background: '#fff', padding: '2px 7px', borderRadius: 'var(--r-full)' }}>{badge.text}</div>
                        </div>
                        <div style={{ padding: '9px 10px' }}>
                          <p style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                          <p style={{ fontSize: '13px', fontWeight: 800, color: item.is_free ? 'var(--success)' : 'var(--ink)', margin: 0 }}>{formatPrice(item.price, item.is_free)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {section === 'feed' && (
              myFeed.length === 0 ? <EmptyState emoji="📸" title="아직 올린 자랑글이 없어요" /> : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                  {myFeed.map(feed => (
                    <div key={feed.id} style={{ aspectRatio: '1', background: 'var(--surface-2)', overflow: 'hidden', position: 'relative', borderRadius: 'var(--r-sm)' }}>
                      {feed.image_url ? <img src={feed.image_url} alt="피드" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--ink-4)', padding: '8px', textAlign: 'center' }}>{(feed.content ?? '').slice(0, 30)}</div>}
                      <div style={{ position: 'absolute', bottom: '5px', right: '5px' }}>
                        <span style={{ fontSize: '10px', color: '#fff', background: 'rgba(26,21,35,0.55)', padding: '2px 6px', borderRadius: 'var(--r-full)' }}>❤️ {feed.like_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {section === 'liked' && (
              likedPosts.length === 0 ? <EmptyState emoji="❤️" title="아직 좋아요한 제보가 없어요" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {likedPosts.map(post => (
                    <div key={post.id} onClick={() => { onClose(); onSelectPost(post) }} className="pressable" style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: 'var(--r-md)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}>
                      <div style={{ width: '58px', height: '58px', borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {post.image_url ? <img src={post.image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '24px' }}>🧸</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</p>
                        <div style={{ display: 'flex', gap: '9px' }}>
                          <Stat icon="👁" value={post.view_count ?? 0} />
                          <Stat icon="❤️" value={post.like_count ?? 0} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {/* 로그아웃 */}
        <button onClick={handleLogout} style={{ width: '100%', padding: '14px', marginTop: '20px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-3)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>로그아웃</button>
      </main>
    </div>
  )
}
