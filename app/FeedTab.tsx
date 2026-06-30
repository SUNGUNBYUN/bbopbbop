'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type FeedPost = {
  id: string
  content: string | null
  image_url: string | null
  user_id: string
  nickname: string | null
  like_count: number
  comment_count: number
  created_at: string
}

type FeedComment = {
  id: string
  feed_id: string
  user_id: string
  nickname: string | null
  content: string
  created_at: string
}

type User = {
  id: string
  email: string
  nickname: string
}

type Props = {
  user: User | null
  onRequireAuth: () => void
}

export default function FeedTab({ user, onRequireAuth }: Props) {
  const [feeds, setFeeds] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFeed, setSelectedFeed] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [myLiked, setMyLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [likedFeeds, setLikedFeeds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchFeeds()
  }, [])

  useEffect(() => {
    if (user) fetchMyLikes()
  }, [user])

  async function fetchFeeds() {
    setLoading(true)
    const { data } = await supabase
      .from('feed_posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setFeeds(data)
    setLoading(false)
  }

  async function fetchMyLikes() {
    if (!user) return
    const { data } = await supabase
      .from('feed_likes')
      .select('feed_id')
      .eq('user_id', user.id)
    if (data) {
      setLikedFeeds(new Set(data.map(d => d.feed_id)))
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function handleImageRemove(e: React.MouseEvent) {
    e.stopPropagation()
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!user) { onRequireAuth(); return }
    if (!content.trim() && !imageFile) return
    setUploading(true)

    let image_url = null
    if (imageFile) {
      const fileName = `feed_${Date.now()}_${imageFile.name}`
      const { data, error } = await supabase.storage.from('images').upload(fileName, imageFile)
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('images').getPublicUrl(data.path)
        image_url = urlData.publicUrl
      }
    }

    const { error } = await supabase.from('feed_posts').insert({
      content: content.trim(),
      image_url,
      user_id: user.id,
      nickname: user.nickname,
    })

    if (!error) {
      setContent(''); setImageFile(null); setImagePreview(null)
      setShowForm(false); fetchFeeds()
    }
    setUploading(false)
  }

  async function handleFeedLike(feed: FeedPost) {
    if (!user) { onRequireAuth(); return }
    const isLiked = likedFeeds.has(feed.id)

    if (isLiked) {
      await supabase.from('feed_likes').delete().eq('feed_id', feed.id).eq('user_id', user.id)
      const newCount = feed.like_count - 1
      await supabase.from('feed_posts').update({ like_count: newCount }).eq('id', feed.id)
      likedFeeds.delete(feed.id)
      setLikedFeeds(new Set(likedFeeds))
      setFeeds(feeds.map(f => f.id === feed.id ? { ...f, like_count: newCount } : f))
      if (selectedFeed?.id === feed.id) {
        setMyLiked(false)
        setLikeCount(newCount)
      }
    } else {
      const { error } = await supabase.from('feed_likes').insert({ feed_id: feed.id, user_id: user.id })
      if (!error) {
        const newCount = feed.like_count + 1
        await supabase.from('feed_posts').update({ like_count: newCount }).eq('id', feed.id)
        likedFeeds.add(feed.id)
        setLikedFeeds(new Set(likedFeeds))
        setFeeds(feeds.map(f => f.id === feed.id ? { ...f, like_count: newCount } : f))
        if (selectedFeed?.id === feed.id) {
          setMyLiked(true)
          setLikeCount(newCount)
        }
      }
    }
  }

  async function openDetail(feed: FeedPost) {
    setSelectedFeed(feed)
    setLikeCount(feed.like_count)
    setMyLiked(likedFeeds.has(feed.id))

    const { data } = await supabase
      .from('feed_comments')
      .select('*')
      .eq('feed_id', feed.id)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  async function handleComment() {
    if (!user) { onRequireAuth(); return }
    if (!selectedFeed || !newComment.trim()) return
    setCommentLoading(true)

    const { error } = await supabase.from('feed_comments').insert({
      feed_id: selectedFeed.id,
      user_id: user.id,
      nickname: user.nickname,
      content: newComment.trim()
    })

    if (!error) {
      const { data } = await supabase
        .from('feed_comments')
        .select('*')
        .eq('feed_id', selectedFeed.id)
        .order('created_at', { ascending: true })
      if (data) {
        setComments(data)
        await supabase.from('feed_posts')
          .update({ comment_count: data.length })
          .eq('id', selectedFeed.id)
        setFeeds(feeds.map(f => f.id === selectedFeed.id ? { ...f, comment_count: data.length } : f))
      }
      setNewComment('')
    }
    setCommentLoading(false)
  }

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '방금 전'
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
    return `${Math.floor(diff / 86400)}일 전`
  }

  // 상세 화면
  if (selectedFeed) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => { setSelectedFeed(null); fetchFeeds() }} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>←</button>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, flex: 1 }}>자랑 상세</h2>
        </div>

        <main style={{ flex: 1, overflowY: 'auto' }}>
          {selectedFeed.image_url && (
            <img src={selectedFeed.image_url} alt="자랑" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} />
          )}

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 작성자 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FF6B6B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '700', flexShrink: 0 }}>
                {(selectedFeed.nickname ?? '익명')[0]}
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#222', margin: '0 0 2px' }}>{selectedFeed.nickname ?? '익명'}</p>
                <p style={{ fontSize: '11px', color: '#aaa', margin: 0 }}>{timeAgo(selectedFeed.created_at)}</p>
              </div>
            </div>

            {/* 내용 */}
            {selectedFeed.content && (
              <p style={{ fontSize: '15px', color: '#222', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>{selectedFeed.content}</p>
            )}

            {/* 좋아요/댓글 수 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#bbb' }}>❤️ {likeCount}</span>
              <span style={{ fontSize: '12px', color: '#bbb' }}>💬 {comments.length}</span>
            </div>

            {/* 좋아요 버튼 */}
            <button
              onClick={() => handleFeedLike(selectedFeed)}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: myLiked ? '#FF6B6B' : '#FFF5F5', color: myLiked ? '#fff' : '#FF6B6B', border: '1.5px solid #FF6B6B', cursor: 'pointer', fontSize: '15px', fontWeight: '700', transition: 'all 0.2s' }}
            >
              {myLiked ? '❤️ 좋아요!' : '🤍 좋아요'} {likeCount > 0 && `(${likeCount})`}
            </button>

            {/* 댓글 */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#222', margin: '0 0 12px' }}>
                댓글 {comments.length > 0 && `(${comments.length})`}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {comments.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#bbb', textAlign: 'center', padding: '20px 0' }}>첫 번째 댓글을 남겨보세요 😊</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#888', flexShrink: 0 }}>
                        {(c.nickname ?? '익')[0]}
                      </div>
                      <div style={{ flex: 1, backgroundColor: '#fafafa', borderRadius: '10px', padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#444' }}>{c.nickname ?? '익명'}</span>
                          <span style={{ fontSize: '11px', color: '#bbb' }}>{timeAgo(c.created_at)}</span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#222', margin: 0, lineHeight: '1.5' }}>{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder={user ? '댓글을 입력하세요...' : '로그인 후 댓글을 남길 수 있어요'}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '13px', outline: 'none', backgroundColor: '#fafafa' }}
                />
                <button
                  onClick={handleComment}
                  disabled={!newComment.trim() || commentLoading}
                  style={{ padding: '10px 16px', borderRadius: '10px', backgroundColor: newComment.trim() ? '#FF6B6B' : '#f0f0f0', color: newComment.trim() ? '#fff' : '#ccc', border: 'none', cursor: newComment.trim() ? 'pointer' : 'default', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}
                >등록</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 등록 폼
  if (showForm) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={() => { setShowForm(false); setImagePreview(null); setImageFile(null); setContent('') }} style={{ fontSize: '14px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>취소</button>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>자랑하기</h2>
          <button onClick={handleSubmit} disabled={uploading || (!content.trim() && !imageFile)} style={{ fontSize: '14px', color: '#fff', fontWeight: '600', background: (content.trim() || imageFile) ? '#FF6B6B' : '#ccc', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: '20px', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? '올리는 중...' : '올리기'}
          </button>
        </div>

        <main style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 사진 */}
          <div onClick={() => fileInputRef.current?.click()} style={{ width: '100%', height: '240px', borderRadius: '16px', border: imagePreview ? 'none' : '2px dashed #f0f0f0', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="미리보기" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={handleImageRemove} style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '36px' }}>📸</span>
                <p style={{ fontSize: '14px', color: '#aaa', margin: '8px 0 0' }}>뽑기 결과를 자랑해보세요!</p>
                <p style={{ fontSize: '12px', color: '#ccc', margin: '4px 0 0' }}>탭해서 사진 추가</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />

          {/* 내용 */}
          <textarea
            placeholder="오늘 뭘 뽑았나요? 자랑해보세요! 🎉"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box', height: '120px', resize: 'none', fontFamily: 'inherit', lineHeight: '1.6' }}
          />
        </main>
      </div>
    )
  }

  // 피드 목록
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <main style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>불러오는 중... 🔄</p>
        ) : feeds.length === 0 ? (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>
            아직 자랑글이 없어요. 첫 번째로 자랑해보세요! 📸
          </p>
        ) : (
          feeds.map(feed => (
            <div key={feed.id} style={{ borderRadius: '16px', border: '1px solid #f0f0f0', overflow: 'hidden' }}>
              {/* 작성자 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FF6B6B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>
                  {(feed.nickname ?? '익명')[0]}
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#222', margin: 0 }}>{feed.nickname ?? '익명'}</p>
                  <p style={{ fontSize: '11px', color: '#bbb', margin: 0 }}>{timeAgo(feed.created_at)}</p>
                </div>
              </div>

              {/* 사진 */}
              {feed.image_url && (
                <div onClick={() => openDetail(feed)} style={{ cursor: 'pointer' }}>
                  <img src={feed.image_url} alt="자랑" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }} />
                </div>
              )}

              {/* 내용 + 반응 */}
              <div style={{ padding: '12px 14px' }}>
                {feed.content && (
                  <p onClick={() => openDetail(feed)} style={{ fontSize: '14px', color: '#222', margin: '0 0 10px', lineHeight: '1.5', cursor: 'pointer', whiteSpace: 'pre-wrap' }}>{feed.content}</p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button
                    onClick={() => handleFeedLike(feed)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <span style={{ fontSize: '16px' }}>{likedFeeds.has(feed.id) ? '❤️' : '🤍'}</span>
                    <span style={{ fontSize: '12px', color: '#888' }}>{feed.like_count}</span>
                  </button>
                  <button
                    onClick={() => openDetail(feed)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <span style={{ fontSize: '16px' }}>💬</span>
                    <span style={{ fontSize: '12px', color: '#888' }}>{feed.comment_count}</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      <button
        onClick={() => { if (!user) { onRequireAuth(); return }; setShowForm(true) }}
        style={{ position: 'fixed', bottom: '72px', right: 'calc(50% - 215px + 20px)', width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#FF6B6B', color: '#fff', fontSize: '24px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,107,107,0.4)' }}
      >+</button>
    </div>
  )
}