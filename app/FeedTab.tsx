'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User, FeedPost, Place } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { notify } from '@/lib/social'
import { Header, BackButton, IconButton, Avatar, Button, Input, Field, EmptyState } from '@/components/ui'
import { ReportSheet } from '@/components/ReportSheet'
import { MultiImageUploader, uploadImages, ImageSlot } from '@/components/MultiImageUploader'
import { ImageGallery } from '@/components/ImageGallery'
import { PlaceSearchSheet } from '@/components/PlaceSearchSheet'

type FeedComment = {
  id: string
  feed_id: string
  user_id: string
  nickname: string | null
  content: string
  created_at: string
}

type OpenChat = (otherId: string, otherNickname: string | null, sourceType: 'post' | 'market' | 'feed', sourceId: string, sourceTitle: string | null) => void
type Props = { user: User | null; onRequireAuth: () => void; onOpenChat: OpenChat }

/** 글에 담긴 사진들을 배열로 (구버전 image_url 호환) */
function galleryOf(feed: FeedPost): string[] {
  if (feed.images && feed.images.length > 0) return feed.images
  return feed.image_url ? [feed.image_url] : []
}

/** 장소 뱃지 */
function PlaceBadge({ name, addr, size = 'sm' }: { name: string; addr?: string | null; size?: 'sm' | 'lg' }) {
  if (size === 'lg') {
    return (
      <div style={{ padding: '13px 14px', borderRadius: 'var(--r-md)', background: 'var(--coral-soft)', border: '1.5px solid var(--coral)' }}>
        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px' }}>📍 {name}</p>
        {addr && <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{addr}</p>}
      </div>
    )
  }
  return (
    <p style={{ fontSize: '12.5px', color: 'var(--coral)', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      📍 {name}
    </p>
  )
}

export default function FeedTab({ user, onRequireAuth, onOpenChat }: Props) {
  const [feeds, setFeeds] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FeedPost | null>(null)
  const [selected, setSelected] = useState<FeedPost | null>(null)
  const [likedFeeds, setLikedFeeds] = useState<Set<string>>(new Set())

  useEffect(() => { fetchFeeds() }, [])
  useEffect(() => { if (user) fetchMyLikes() }, [user])

  async function fetchFeeds() {
    setLoading(true)
    const { data } = await supabase.from('feed_posts').select('*').order('created_at', { ascending: false })
    if (data) setFeeds(data)
    setLoading(false)
  }

  async function fetchMyLikes() {
    if (!user) return
    const { data } = await supabase.from('feed_likes').select('feed_id').eq('user_id', user.id)
    if (data) setLikedFeeds(new Set(data.map(d => d.feed_id)))
  }

  async function handleLike(feed: FeedPost) {
    if (!user) { onRequireAuth(); return }
    const isLiked = likedFeeds.has(feed.id)
    if (isLiked) {
      await supabase.from('feed_likes').delete().eq('feed_id', feed.id).eq('user_id', user.id)
      const { data: rc } = await supabase.rpc('sync_feed_like_count', { p_feed_id: feed.id })
      const c = typeof rc === 'number' ? rc : Math.max(0, feed.like_count - 1)
      likedFeeds.delete(feed.id); setLikedFeeds(new Set(likedFeeds))
      setFeeds(feeds.map(f => f.id === feed.id ? { ...f, like_count: c } : f))
    } else {
      const { error } = await supabase.from('feed_likes').insert({ feed_id: feed.id, user_id: user.id })
      if (!error) {
        const { data: rc } = await supabase.rpc('sync_feed_like_count', { p_feed_id: feed.id })
        const c = typeof rc === 'number' ? rc : feed.like_count + 1
        likedFeeds.add(feed.id); setLikedFeeds(new Set(likedFeeds))
        setFeeds(feeds.map(f => f.id === feed.id ? { ...f, like_count: c } : f))
      } else {
        // 실패 시 좋아요 표시 원복(이미 눌렀거나 오류)
        likedFeeds.delete(feed.id); setLikedFeeds(new Set(likedFeeds))
        notify({ userId: feed.user_id, actorId: user.id, actorNickname: user.nickname, type: 'feed_like', targetType: 'feed', targetId: feed.id })
      }
    }
  }

  if (selected) {
    return (
      <FeedDetail
        feed={selected}
        user={user}
        liked={likedFeeds.has(selected.id)}
        onToggleLike={() => handleLike(selected)}
        onBack={() => { setSelected(null); fetchFeeds() }}
        onEdit={() => { setEditing(selected); setSelected(null) }}
        onRequireAuth={onRequireAuth}
        onOpenChat={onOpenChat}
      />
    )
  }
  if ((showForm || editing) && user) {
    return (
      <FeedForm
        user={user}
        editing={editing}
        onClose={() => { setShowForm(false); setEditing(null) }}
        onSubmitted={() => { setShowForm(false); setEditing(null); fetchFeeds() }}
      />
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px' }}>
                <div className="skeleton" style={{ width: '34px', height: '34px', borderRadius: '50%' }} />
                <div className="skeleton" style={{ width: '90px', height: '13px' }} />
              </div>
              <div className="skeleton" style={{ width: '100%', aspectRatio: '1' }} />
            </div>
          ))
        ) : feeds.length === 0 ? (
          <EmptyState emoji="📸" title="아직 자랑글이 없어요" desc="오늘 뽑은 인형을 제일 먼저 자랑해보세요!" action={<Button onClick={() => { if (!user) { onRequireAuth(); return }; setShowForm(true) }}>+ 자랑하기</Button>} />
        ) : (
          feeds.map(feed => {
            const imgs = galleryOf(feed)
            return (
              <div key={feed.id} style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px' }}>
                  <Avatar name={feed.nickname} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{feed.nickname ?? '익명'}</p>
                    <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: 0 }}>
                      {timeAgo(feed.created_at)}{feed.updated_at ? ' · 수정됨' : ''}
                    </p>
                  </div>
                </div>

                {imgs.length > 0 && (
                  <div onClick={() => setSelected(feed)} style={{ cursor: 'pointer' }}>
                    <ImageGallery images={imgs} />
                  </div>
                )}

                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: (feed.content || feed.place_name) ? '10px' : 0 }}>
                    <button onClick={() => handleLike(feed)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <span style={{ fontSize: '19px' }}>{likedFeeds.has(feed.id) ? '❤️' : '🤍'}</span>
                      <span style={{ fontSize: '13px', color: 'var(--ink-2)', fontWeight: 600 }}>{feed.like_count}</span>
                    </button>
                    <button onClick={() => setSelected(feed)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <span style={{ fontSize: '18px' }}>💬</span>
                      <span style={{ fontSize: '13px', color: 'var(--ink-2)', fontWeight: 600 }}>{feed.comment_count}</span>
                    </button>
                  </div>

                  {feed.place_name && (
                    <div style={{ marginBottom: feed.content ? '8px' : 0 }}>
                      <PlaceBadge name={feed.place_name} />
                    </div>
                  )}

                  {feed.content && (
                    <p onClick={() => setSelected(feed)} style={{ fontSize: '14px', color: 'var(--ink)', margin: 0, lineHeight: 1.5, cursor: 'pointer', whiteSpace: 'pre-wrap' }}>{feed.content}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </main>

      <button onClick={() => { if (!user) { onRequireAuth(); return }; setShowForm(true) }} className="pressable" style={{ position: 'absolute', bottom: 'calc(var(--nav-h) + 16px)', right: '18px', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--coral)', color: '#fff', fontSize: '28px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-coral)', zIndex: 40 }}>+</button>
    </div>
  )
}

function FeedDetail({ feed, user, liked, onToggleLike, onBack, onEdit, onRequireAuth, onOpenChat }: {
  feed: FeedPost; user: User | null; liked: boolean; onToggleLike: () => void; onBack: () => void; onEdit: () => void; onRequireAuth: () => void; onOpenChat: OpenChat
}) {
  const [comments, setComments] = useState<FeedComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [myLiked, setMyLiked] = useState(liked)
  const [likeCount, setLikeCount] = useState(feed.like_count)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const isMine = user?.id === feed.user_id
  const imgs = galleryOf(feed)

  useEffect(() => {
    supabase.from('feed_comments').select('*').eq('feed_id', feed.id).order('created_at', { ascending: true }).then(({ data }) => {
      if (data) setComments(data)
    })
  }, [feed.id])

  function toggleLike() {
    onToggleLike()
    setMyLiked(!myLiked)
    setLikeCount(myLiked ? likeCount - 1 : likeCount + 1)
  }

  async function handleComment() {
    if (!user) { onRequireAuth(); return }
    if (!newComment.trim()) return
    const { error } = await supabase.from('feed_comments').insert({ feed_id: feed.id, user_id: user.id, nickname: user.nickname, content: newComment.trim() })
    if (!error) {
      const { data } = await supabase.from('feed_comments').select('*').eq('feed_id', feed.id).order('created_at', { ascending: true })
      if (data) { setComments(data); await supabase.rpc('sync_feed_comment_count', { p_feed_id: feed.id }) }
      setNewComment('')
      notify({ userId: feed.user_id, actorId: user.id, actorNickname: user.nickname, type: 'feed_comment', targetType: 'feed', targetId: feed.id })
    }
  }

  async function handleDelete() {
    if (!confirm('이 자랑글을 삭제할까요?')) return
    await supabase.from('feed_posts').delete().eq('id', feed.id)
    onBack()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <Header
        left={<BackButton onClick={onBack} />}
        title="자랑 상세"
        right={
          isMine ? (
            <div style={{ position: 'relative' }}>
              <IconButton onClick={() => setMenuOpen(!menuOpen)}>⋯</IconButton>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                  <div style={{ position: 'absolute', top: '42px', right: 0, background: 'var(--surface)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', zIndex: 31, overflow: 'hidden', minWidth: '130px' }}>
                    <button onClick={() => { setMenuOpen(false); onEdit() }} style={{ width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--line)', background: 'none', textAlign: 'left', fontSize: '14px', color: 'var(--ink)', fontWeight: 600, cursor: 'pointer' }}>✏️ 수정하기</button>
                    <button onClick={handleDelete} style={{ width: '100%', padding: '12px 16px', border: 'none', background: 'none', textAlign: 'left', fontSize: '14px', color: 'var(--danger)', fontWeight: 600, cursor: 'pointer' }}>🗑 삭제하기</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <IconButton onClick={() => setShowReport(true)} aria-label="신고">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 8v5M12 16h.01M10.3 3.9L2 18a1 1 0 00.9 1.5h18.2A1 1 0 0022 18L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </IconButton>
          )
        }
      />

      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {imgs.length > 0 && <ImageGallery images={imgs} />}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar name={feed.nickname} />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px' }}>{feed.nickname ?? '익명'}</p>
              <p style={{ fontSize: '12px', color: 'var(--ink-4)', margin: 0 }}>
                {timeAgo(feed.created_at)}{feed.updated_at ? ' · 수정됨' : ''}
              </p>
            </div>
          </div>

          {feed.place_name && <PlaceBadge name={feed.place_name} addr={feed.location} size="lg" />}

          {feed.content && <p style={{ fontSize: '15px', color: 'var(--ink)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{feed.content}</p>}

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button size="lg" variant={myLiked ? 'primary' : 'soft'} onClick={toggleLike} style={{ flex: 1 }}>
              {myLiked ? '❤️ 좋아요' : '🤍 좋아요'} {likeCount > 0 && likeCount}
            </Button>
            {user?.id !== feed.user_id && (
              <Button size="lg" variant="mint" onClick={() => onOpenChat(feed.user_id, feed.nickname, 'feed', feed.id, feed.content?.slice(0, 20) ?? '자랑글')} style={{ flex: 1 }}>
                💬 채팅하기
              </Button>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px' }}>댓글 {comments.length > 0 && <span style={{ color: 'var(--coral)' }}>{comments.length}</span>}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {comments.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--ink-4)', textAlign: 'center', padding: '24px 0' }}>첫 댓글을 남겨보세요 😊</p>
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

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', background: 'var(--surface)', flexShrink: 0 }}>
        <Input placeholder={user ? '댓글 입력...' : '로그인 후 댓글'} value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleComment()} style={{ flex: 1, padding: '11px 14px' }} />
        <Button onClick={handleComment} disabled={!newComment.trim()} variant={newComment.trim() ? 'primary' : 'outline'} style={{ flexShrink: 0 }}>등록</Button>
      </div>

      {showReport && (
        <ReportSheet user={user} targetType="feed" targetId={feed.id} targetUserId={feed.user_id} targetNickname={feed.nickname} onClose={() => setShowReport(false)} onRequireAuth={onRequireAuth} onDone={(msg) => { setShowReport(false); alert(msg) }} />
      )}
    </div>
  )
}

function FeedForm({ user, editing, onClose, onSubmitted }: { user: User; editing: FeedPost | null; onClose: () => void; onSubmitted: () => void }) {
  const isEdit = !!editing
  const [content, setContent] = useState(editing?.content ?? '')
  // 수정 시 기존 사진(URL) / 새로 추가한 사진(File) 분리 관리
  const [keptUrls, setKeptUrls] = useState<string[]>(editing ? galleryOf(editing) : [])
  const [images, setImages] = useState<ImageSlot[]>([])
  const [uploading, setUploading] = useState(false)
  // 장소 (선택)
  const [placeName, setPlaceName] = useState(editing?.place_name ?? '')
  const [placeAddr, setPlaceAddr] = useState(editing?.location ?? '')
  const [placeLat, setPlaceLat] = useState<number | null>(editing?.latitude ?? null)
  const [placeLng, setPlaceLng] = useState<number | null>(editing?.longitude ?? null)
  const [showPlaceSearch, setShowPlaceSearch] = useState(false)

  const totalPhotos = keptUrls.length + images.length

  function handlePlaceSelect(place: Place) {
    setPlaceName(place.place_name)
    setPlaceAddr(place.road_address_name || place.address_name)
    setPlaceLat(parseFloat(place.y))
    setPlaceLng(parseFloat(place.x))
    setShowPlaceSearch(false)
  }

  async function handleSubmit() {
    if (!content.trim() && totalPhotos === 0) return
    setUploading(true)

    let newUrls: string[] = []
    if (images.length > 0) {
      try {
        newUrls = await uploadImages(supabase, images, 'feed_')
      } catch (e: any) {
        setUploading(false)
        alert(e?.message ?? '사진 업로드에 실패했어요')
        return
      }
    }

    const allUrls = [...keptUrls, ...newUrls]
    const payload = {
      content: content.trim(),
      image_url: allUrls[0] ?? null,
      images: allUrls,
      place_name: placeName || null,
      location: placeAddr || null,
      latitude: placeLat,
      longitude: placeLng,
    }

    const { error } = isEdit
      ? await supabase.from('feed_posts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing!.id)
      : await supabase.from('feed_posts').insert({ ...payload, user_id: user.id, nickname: user.nickname })

    setUploading(false)
    if (!error) onSubmitted()
    else alert('저장에 실패했어요. 다시 시도해주세요')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--bg)' }}>
      <Header
        left={<button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '14px', color: 'var(--ink-3)', cursor: 'pointer', padding: '8px' }}>취소</button>}
        title={isEdit ? '자랑글 수정' : '자랑하기'}
        right={<Button size="sm" onClick={handleSubmit} disabled={uploading || (!content.trim() && totalPhotos === 0)}>{uploading ? '올리는 중' : isEdit ? '저장' : '올리기'}</Button>}
      />
      <main className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 기존 사진 (수정 시) */}
        {keptUrls.length > 0 && (
          <Field label="등록된 사진">
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
              {keptUrls.map((url, i) => (
                <div key={url + i} style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: '84px', height: '84px', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                    <img src={url} alt="사진" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <button
                    onClick={() => setKeptUrls(keptUrls.filter((_, idx) => idx !== i))}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(26,21,35,0.75)', color: '#fff', fontSize: '12px', border: 'none', cursor: 'pointer' }}
                  >✕</button>
                </div>
              ))}
            </div>
          </Field>
        )}

        {/* 사진 추가 (여러 장) */}
        <Field label={keptUrls.length > 0 ? '사진 더 추가' : '사진'} optional={keptUrls.length > 0}>
          <MultiImageUploader images={images} onChange={setImages} max={Math.max(1, 5 - keptUrls.length)} />
        </Field>

        <textarea placeholder="오늘 뭘 뽑았나요? 자랑해보세요! 🎉" value={content} onChange={(e) => setContent(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', fontSize: '14.5px', outline: 'none', minHeight: '110px', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />

        {/* 장소 (선택) — 마켓처럼 검색 */}
        <Field label="어디서 뽑았어요?" optional>
          {placeName ? (
            <div style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--coral)', background: 'var(--coral-soft)', position: 'relative' }}>
              <p style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px', paddingRight: '32px' }}>📍 {placeName}</p>
              {placeAddr && <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{placeAddr}</p>}
              <button onClick={() => { setPlaceName(''); setPlaceAddr(''); setPlaceLat(null); setPlaceLng(null) }} style={{ position: 'absolute', top: '12px', right: '12px', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', color: 'var(--ink-3)', fontSize: '13px', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowPlaceSearch(true)} className="pressable" style={{ width: '100%', padding: '14px 15px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', fontSize: '15px', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>🔍 뽑은 장소 검색하기 (선택)</button>
          )}
        </Field>
      </main>

      {showPlaceSearch && (
        <PlaceSearchSheet user={user} onSelect={handlePlaceSelect} onClose={() => setShowPlaceSearch(false)} />
      )}
    </div>
  )
}
