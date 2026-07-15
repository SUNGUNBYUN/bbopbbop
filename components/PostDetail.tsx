'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Post, Comment, User } from '@/lib/types'
import { timeAgo, freshness } from '@/lib/utils'
import { notify } from '@/lib/social'
import { verifyPost } from '@/lib/points'
import { Header, BackButton, IconButton, Avatar, Button, Stat, Input } from './ui'
import { ReportSheet } from './ReportSheet'
import { ImageGallery } from './ImageGallery'

type Props = {
  post: Post
  user: User | null
  onBack: () => void
  onRequireAuth: () => void
  onOpenChat: () => void
  onStartChat: () => void
  onDeleted: () => void
}

export function PostDetail({ post, user, onBack, onRequireAuth, onOpenChat, onStartChat, onDeleted }: Props) {
  const [viewCount, setViewCount] = useState(0)
  const [likeCount, setLikeCount] = useState(0)
  const [myLiked, setMyLiked] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [verifyCount, setVerifyCount] = useState(post.verify_count ?? 0)
  const [verifying, setVerifying] = useState(false)

  const isMine = user?.id === post.user_id

  useEffect(() => {
    fetchDetail()
  }, [post.id])

  async function fetchDetail() {
    await supabase.rpc('increment_view_count', { post_id: post.id })
    const { data: postData } = await supabase.from('posts').select('*').eq('id', post.id).single()
    if (postData) { setViewCount(postData.view_count ?? 0); setLikeCount(postData.like_count ?? 0) }
    const { data: likesData } = await supabase.from('likes').select('*').eq('post_id', post.id)
    if (likesData) { setLikeCount(likesData.length); if (user) setMyLiked(likesData.some(l => l.user_id === user.id)) }
    const { data: commentsData } = await supabase.from('comments').select('*').eq('post_id', post.id).order('created_at', { ascending: true })
    if (commentsData) setComments(commentsData)
  }

  async function handleLike() {
    if (!user) { onRequireAuth(); return }
    setLikeLoading(true)
    if (myLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id)
      const c = likeCount - 1
      await supabase.from('posts').update({ like_count: c }).eq('id', post.id)
      setMyLiked(false); setLikeCount(c)
    } else {
      const { error } = await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
      if (!error) {
        const c = likeCount + 1
        await supabase.from('posts').update({ like_count: c }).eq('id', post.id)
        setMyLiked(true); setLikeCount(c)
        if (post.user_id) notify({
          userId: post.user_id, actorId: user.id, actorNickname: user.nickname,
          type: 'like', targetType: 'post', targetId: post.id, targetTitle: post.title,
        })
      }
    }
    setLikeLoading(false)
  }

  async function handleComment() {
    if (!user) { onRequireAuth(); return }
    if (!newComment.trim()) return
    const content = newComment.trim()
    setCommentLoading(true)
    setNewComment('')

    // 즉시 화면에 반영
    const tempComment: Comment = {
      id: `temp-${Date.now()}`,
      post_id: post.id,
      user_id: user.id,
      nickname: user.nickname,
      content,
      created_at: new Date().toISOString(),
    }
    setComments(prev => [...prev, tempComment])

    const { data: inserted, error } = await supabase.from('comments').insert({
      post_id: post.id, user_id: user.id, nickname: user.nickname, content,
    }).select().single()

    if (!error) {
      if (inserted) {
        setComments(prev => prev.map(c => c.id === tempComment.id ? (inserted as Comment) : c))
      }
      await supabase.from('posts').update({ comment_count: comments.length + 1 }).eq('id', post.id)
      if (post.user_id) notify({
        userId: post.user_id, actorId: user.id, actorNickname: user.nickname,
        type: 'comment', targetType: 'post', targetId: post.id, targetTitle: post.title,
      })
    } else {
      // 실패 시 제거
      setComments(prev => prev.filter(c => c.id !== tempComment.id))
      setNewComment(content)
    }
    setCommentLoading(false)
  }

  async function handleDelete() {
    if (!confirm('이 제보를 삭제할까요? 되돌릴 수 없어요.')) return
    await supabase.from('posts').delete().eq('id', post.id)
    onDeleted()
  }

  async function handleVerify() {
    if (!user) { onRequireAuth(); return }
    setVerifying(true)
    try {
      const r = await verifyPost(post.id)
      if (typeof r?.verify_count === 'number') setVerifyCount(r.verify_count)
      const earned = r?.my_reward ?? 0
      if (earned > 0) alert(`확인해줘서 고마워요! +${earned}P 🎉`)
      else alert('이미 확인한 제보예요. 한 제보는 한 번만 포인트를 받을 수 있어요.')
    } catch (e: any) {
      alert(e.message ?? '확인에 실패했어요')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      <Header
        left={<BackButton onClick={onBack} />}
        title="제보 상세"
        right={
          <>
            {isMine && (
              <div style={{ position: 'relative' }}>
                <IconButton onClick={() => setMenuOpen(!menuOpen)}>⋯</IconButton>
                {menuOpen && (
                  <>
                    <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                    <div style={{
                      position: 'absolute', top: '42px', right: 0, background: 'var(--surface)',
                      borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', zIndex: 31,
                      overflow: 'hidden', minWidth: '130px',
                    }}>
                      <button onClick={handleDelete} style={{
                        width: '100%', padding: '12px 16px', border: 'none', background: 'none',
                        textAlign: 'left', fontSize: '14px', color: 'var(--danger)', fontWeight: 600, cursor: 'pointer',
                      }}>🗑 삭제하기</button>
                    </div>
                  </>
                )}
              </div>
            )}
            {!isMine && (
              <IconButton onClick={() => setShowReport(true)} aria-label="신고">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 8v5M12 16h.01M10.3 3.9L2 18a1 1 0 00.9 1.5h18.2A1 1 0 0022 18L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </IconButton>
            )}
            {user && <IconButton onClick={onOpenChat}>💬</IconButton>}
          </>
        }
      />

      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {(() => {
          const gallery = (post.images && post.images.length > 0) ? post.images : (post.image_url ? [post.image_url] : [])
          return gallery.length > 0 ? <ImageGallery images={gallery} /> : null
        })()}

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* 제목 + 태그 */}
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 8px', lineHeight: 1.3 }}>{post.title}</h1>
            {post.tags && <p style={{ fontSize: '13px', color: 'var(--coral)', margin: 0, fontWeight: 600 }}>{post.tags}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px' }}>
              <Stat icon="👁" value={viewCount} />
              <Stat icon="❤️" value={likeCount} />
              <Stat icon="💬" value={comments.length} />
            </div>
          </div>

          {/* 작성자 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'var(--surface)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)' }}>
            <Avatar name={post.nickname} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px' }}>{post.nickname ?? '익명'}</p>
              <p style={{ fontSize: '12px', color: 'var(--ink-4)', margin: 0 }}>{timeAgo(post.created_at)}</p>
            </div>
            {!isMine && post.user_id && (
              <Button size="sm" onClick={onStartChat}>채팅하기</Button>
            )}
          </div>

          {/* 위치 */}
          {post.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'var(--surface)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)' }}>
              <span style={{ fontSize: '20px' }}>📍</span>
              <p style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--ink)', margin: 0, flex: 1 }}>{post.location}</p>
            </div>
          )}

          {/* 좋아요 버튼 */}
          <Button
            full size="lg"
            variant={myLiked ? 'primary' : 'soft'}
            onClick={handleLike}
            disabled={likeLoading}
          >
            {myLiked ? '❤️ 좋아요 취소' : '🤍 좋아요'} {likeCount > 0 && `${likeCount}`}
          </Button>

          {/* 신선도 안내 */}
          {(() => {
            const f = freshness(post.last_verified_at, post.created_at)
            if (!f.label) return null
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', borderRadius: 'var(--r-md)', background: f.bg }}>
                <span style={{ fontSize: '15px' }}>{f.level === 'fresh' ? '✓' : '🕗'}</span>
                <p style={{ fontSize: '13px', fontWeight: 600, color: f.color, margin: 0 }}>
                  {f.level === 'stale' ? '오래된 정보예요. 지금도 있는지 확인해주세요!' : f.label}
                </p>
              </div>
            )
          })()}

          {/* 재인증: 지금도 진짜 있는지 확인 (본인 제보 제외) */}
          {!isMine && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="pressable"
              style={{ width: '100%', padding: '13px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--mint, var(--coral))', background: 'var(--mint-soft, var(--coral-soft))', color: 'var(--coral)', fontSize: '14px', fontWeight: 700, cursor: verifying ? 'default' : 'pointer', opacity: verifying ? 0.6 : 1 }}
            >
              {verifying ? '확인 중…' : `✅ 지금도 여기 있어요 (+10P)`}
              {verifyCount > 0 && <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--ink-4)' }}>· {verifyCount}명 확인</span>}
            </button>
          )}

          {/* 댓글 */}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px' }}>
              댓글 {comments.length > 0 && <span style={{ color: 'var(--coral)' }}>{comments.length}</span>}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
              {comments.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--ink-4)', textAlign: 'center', padding: '24px 0' }}>
                  첫 댓글을 남겨보세요 😊
                </p>
              ) : comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Avatar name={c.nickname} size={30} color="var(--ink-3)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-2)' }}>{c.nickname ?? '익명'}</span>
                      <span style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{timeAgo(c.created_at)}</span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* 댓글 입력 (하단 고정) */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', background: 'var(--surface)', flexShrink: 0 }}>
        <Input
          placeholder={user ? '댓글 입력...' : '로그인 후 댓글 작성'}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleComment()}
          style={{ flex: 1, padding: '11px 14px' }}
        />
        <Button
          onClick={handleComment}
          disabled={!newComment.trim() || commentLoading}
          variant={newComment.trim() ? 'primary' : 'outline'}
          style={{ flexShrink: 0 }}
        >등록</Button>
      </div>

      {showReport && (
        <ReportSheet
          user={user}
          targetType="post"
          targetId={post.id}
          targetUserId={post.user_id}
          targetNickname={post.nickname}
          onClose={() => setShowReport(false)}
          onRequireAuth={onRequireAuth}
          onDone={(msg) => { setShowReport(false); alert(msg) }}
        />
      )}
    </div>
  )
}
