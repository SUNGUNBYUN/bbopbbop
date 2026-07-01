'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import KakaoPlaceSearch from './KakaoMap'
import Auth from './Auth'
import MapTab from './MapTab'
import MarketTab from './MarketTab'
import FeedTab from './FeedTab'
import ChatList from './ChatList'
import MyPage from './MyPage'

type Post = {
  id: string
  title: string
  location: string | null
  tags: string | null
  image_url: string | null
  created_at: string
  user_id: string | null
  nickname: string | null
  view_count: number
  like_count: number
  comment_count: number
  latitude: number | null
  longitude: number | null
  place_name: string | null
}

type Comment = {
  id: string
  post_id: string
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

type Errors = {
  image?: string
  title?: string
  location?: string
}

type Place = {
  place_name: string
  address_name: string
  road_address_name: string
  x: string
  y: string
}

export default function Home() {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showMapSearch, setShowMapSearch] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showMyPage, setShowMyPage] = useState(false)
  const [chatRoomId, setChatRoomId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [locationDetail, setLocationDetail] = useState('')
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [locationPlaceName, setLocationPlaceName] = useState('')
  const [tags, setTags] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [user, setUser] = useState<User | null>(null)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [myLiked, setMyLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [likeLoading, setLikeLoading] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [viewCount, setViewCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchPosts()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          nickname: session.user.user_metadata?.nickname ?? session.user.email ?? ''
        })
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          nickname: session.user.user_metadata?.nickname ?? session.user.email ?? ''
        })
      } else {
        setUser(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!selectedPost) return
    setMyLiked(false)
    setLikeCount(0)
    setComments([])
    setViewCount(0)
    fetchPostDetail(selectedPost.id)
  }, [selectedPost?.id])

  async function fetchPostDetail(postId: string) {
    await supabase.rpc('increment_view_count', { post_id: postId })
    const { data: postData } = await supabase.from('posts').select('*').eq('id', postId).single()
    if (postData) { setViewCount(postData.view_count ?? 0); setLikeCount(postData.like_count ?? 0) }
    const { data: likesData } = await supabase.from('likes').select('*').eq('post_id', postId)
    if (likesData) { setLikeCount(likesData.length); if (user) setMyLiked(likesData.some((l: any) => l.user_id === user.id)) }
    const { data: commentsData } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })
    if (commentsData) setComments(commentsData)
  }

  async function fetchPosts() {
    setLoading(true)
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false })
    if (data) setPosts(data)
    setLoading(false)
  }

  async function handleLogout() { await supabase.auth.signOut(); setUser(null) }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImageFile(file); setImagePreview(URL.createObjectURL(file)); setErrors(prev => ({ ...prev, image: undefined }))
  }

  function handleImageRemove(e: React.MouseEvent) {
    e.stopPropagation(); setImageFile(null); setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handlePlaceSelect(place: Place) {
    setLocation(place.place_name); setLocationDetail(place.road_address_name || place.address_name)
    setLocationLat(parseFloat(place.y)); setLocationLng(parseFloat(place.x)); setLocationPlaceName(place.place_name)
    setShowMapSearch(false); setErrors(prev => ({ ...prev, location: undefined }))
  }

  function validate() {
    const newErrors: Errors = {}
    if (!imageFile) newErrors.image = '사진을 추가해주세요'
    if (!title.trim()) newErrors.title = '뭐가 있는지 알려주세요'
    if (!location.trim()) newErrors.location = '업체 위치를 입력해주세요'
    setErrors(newErrors); return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!user) { setShowAuth(true); return }
    if (!validate()) return; setUploading(true)
    let image_url = null
    if (imageFile) {
      const fileName = `${Date.now()}_${imageFile.name}`
      const { data, error } = await supabase.storage.from('images').upload(fileName, imageFile)
      if (!error && data) { const { data: urlData } = supabase.storage.from('images').getPublicUrl(data.path); image_url = urlData.publicUrl }
    }
    const fullLocation = locationDetail ? `${location} (${locationDetail})` : location
    const { error } = await supabase.from('posts').insert({ title, location: fullLocation, tags, image_url, user_id: user.id, nickname: user.nickname, latitude: locationLat, longitude: locationLng, place_name: locationPlaceName })
    if (!error) { setTitle(''); setLocation(''); setLocationDetail(''); setTags(''); setLocationLat(null); setLocationLng(null); setLocationPlaceName(''); setImageFile(null); setImagePreview(null); setErrors({}); setShowForm(false); fetchPosts() }
    setUploading(false)
  }

  async function handleLike() {
    if (!user) { setShowAuth(true); return }; if (!selectedPost) return; setLikeLoading(true)
    if (myLiked) {
      await supabase.from('likes').delete().eq('post_id', selectedPost.id).eq('user_id', user.id)
      const newCount = likeCount - 1; await supabase.from('posts').update({ like_count: newCount }).eq('id', selectedPost.id)
      setMyLiked(false); setLikeCount(newCount)
    } else {
      const { error } = await supabase.from('likes').insert({ post_id: selectedPost.id, user_id: user.id })
      if (!error) { const newCount = likeCount + 1; await supabase.from('posts').update({ like_count: newCount }).eq('id', selectedPost.id); setMyLiked(true); setLikeCount(newCount) }
    }
    setLikeLoading(false)
  }

  async function handleComment() {
    if (!user) { setShowAuth(true); return }; if (!selectedPost || !newComment.trim()) return; setCommentLoading(true)
    const { error } = await supabase.from('comments').insert({ post_id: selectedPost.id, user_id: user.id, nickname: user.nickname, content: newComment.trim() })
    if (!error) {
      const { data } = await supabase.from('comments').select('*').eq('post_id', selectedPost.id).order('created_at', { ascending: true })
      if (data) { setComments(data); await supabase.from('posts').update({ comment_count: data.length }).eq('id', selectedPost.id) }
      setNewComment('')
    }
    setCommentLoading(false)
  }

  async function startChat() {
    if (!user) { setShowAuth(true); return }; if (!selectedPost || !selectedPost.user_id) return; if (selectedPost.user_id === user.id) return
    const { data: existing } = await supabase.from('chat_rooms').select('*').or(`and(user1_id.eq.${user.id},user2_id.eq.${selectedPost.user_id}),and(user1_id.eq.${selectedPost.user_id},user2_id.eq.${user.id})`).limit(1)
    if (existing && existing.length > 0) { setChatRoomId(existing[0].id); setShowChat(true); return }
    const { data: newRoom, error } = await supabase.from('chat_rooms').insert({ user1_id: user.id, user2_id: selectedPost.user_id, user1_nickname: user.nickname, user2_nickname: selectedPost.nickname, post_id: selectedPost.id, post_title: selectedPost.title }).select().single()
    if (!error && newRoom) { setChatRoomId(newRoom.id); setShowChat(true) }
  }

  async function handleBack() { setSelectedPost(null); setTimeout(() => fetchPosts(), 800) }

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '방금 전'; if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`; return `${Math.floor(diff / 86400)}일 전`
  }

  const filtered = posts.filter(p => p.title.includes(search) || (p.location ?? '').includes(search))

  // 제보 상세
  if (selectedPost) {
    const isMine = user?.id === selectedPost.user_id
    return (
      <div style={{ maxWidth: '430px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        <header style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={handleBack} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>←</button>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, flex: 1 }}>제보 상세</h2>
          {user && <button onClick={() => { setChatRoomId(null); setShowChat(true) }} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer' }}>💬</button>}
        </header>
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {selectedPost.image_url && <img src={selectedPost.image_url} alt={selectedPost.title} style={{ width: '100%', height: '280px', objectFit: 'cover' }} />}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#222', margin: '0 0 8px' }}>{selectedPost.title}</h3>
              {selectedPost.tags && <p style={{ fontSize: '13px', color: '#FF6B6B', margin: 0 }}>{selectedPost.tags}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#bbb' }}>👁️ {viewCount}</span>
              <span style={{ fontSize: '12px', color: '#bbb' }}>❤️ {likeCount}</span>
              <span style={{ fontSize: '12px', color: '#bbb' }}>💬 {comments.length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#fafafa', borderRadius: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FF6B6B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '700', flexShrink: 0 }}>{(selectedPost.nickname ?? '익명')[0]}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#222', margin: '0 0 2px' }}>{selectedPost.nickname ?? '익명'}</p>
                <p style={{ fontSize: '11px', color: '#aaa', margin: 0 }}>{timeAgo(selectedPost.created_at)}</p>
              </div>
              {!isMine && selectedPost.user_id && <button onClick={startChat} style={{ padding: '6px 14px', borderRadius: '20px', backgroundColor: '#FF6B6B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>채팅하기</button>}
            </div>
            {selectedPost.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px', backgroundColor: '#fafafa', borderRadius: '12px' }}>
                <span style={{ fontSize: '18px' }}>📍</span>
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#222', margin: 0 }}>{selectedPost.location}</p>
              </div>
            )}
            <button onClick={handleLike} disabled={likeLoading} style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: myLiked ? '#FF6B6B' : '#FFF5F5', color: myLiked ? '#fff' : '#FF6B6B', border: '1.5px solid #FF6B6B', cursor: 'pointer', fontSize: '15px', fontWeight: '700', transition: 'all 0.2s' }}>
              {myLiked ? '❤️ 좋아요!' : '🤍 좋아요'} {likeCount > 0 && `(${likeCount})`}
            </button>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#222', margin: '0 0 12px' }}>댓글 {comments.length > 0 && `(${comments.length})`}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {comments.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#bbb', textAlign: 'center', padding: '20px 0' }}>첫 번째 댓글을 남겨보세요 😊</p>
                ) : comments.map(comment => (
                  <div key={comment.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#888', flexShrink: 0 }}>{(comment.nickname ?? '익')[0]}</div>
                    <div style={{ flex: 1, backgroundColor: '#fafafa', borderRadius: '10px', padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#444' }}>{comment.nickname ?? '익명'}</span>
                        <span style={{ fontSize: '11px', color: '#bbb' }}>{timeAgo(comment.created_at)}</span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#222', margin: 0, lineHeight: '1.5' }}>{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder={user ? '댓글을 입력하세요...' : '로그인 후 댓글을 남길 수 있어요'} value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleComment()} style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '13px', outline: 'none', backgroundColor: '#fafafa' }} />
                <button onClick={handleComment} disabled={!newComment.trim() || commentLoading} style={{ padding: '10px 16px', borderRadius: '10px', backgroundColor: newComment.trim() ? '#FF6B6B' : '#f0f0f0', color: newComment.trim() ? '#fff' : '#ccc', border: 'none', cursor: newComment.trim() ? 'pointer' : 'default', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>등록</button>
              </div>
            </div>
          </div>
        </main>
        {showChat && user && <ChatList user={user} initialRoomId={chatRoomId} onClose={() => { setShowChat(false); setChatRoomId(null) }} />}
        {showAuth && <Auth onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}
      </div>
    )
  }

  // 제보하기 폼
  if (showForm) {
    return (
      <div style={{ maxWidth: '430px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        <header style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => { setShowForm(false); setImagePreview(null); setImageFile(null); setErrors({}); setLocation(''); setLocationDetail('') }} style={{ fontSize: '14px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>취소</button>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>제보하기</h2>
          <button onClick={handleSubmit} disabled={uploading} style={{ fontSize: '14px', color: '#fff', fontWeight: '600', background: '#FF6B6B', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: '20px', opacity: uploading ? 0.6 : 1 }}>{uploading ? '올리는 중...' : '올리기'}</button>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>사진 <span style={{ color: '#FF6B6B' }}>*</span></label>
            <div onClick={() => fileInputRef.current?.click()} style={{ width: '100%', height: '200px', borderRadius: '16px', border: errors.image ? '2px dashed #FF6B6B' : imagePreview ? 'none' : '2px dashed #f0f0f0', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
              {imagePreview ? (<><img src={imagePreview} alt="미리보기" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /><button onClick={handleImageRemove} style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button><div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '11px', padding: '4px 8px', borderRadius: '8px' }}>탭해서 변경</div></>) : (<><span style={{ fontSize: '36px' }}>📷</span><p style={{ fontSize: '14px', color: errors.image ? '#FF6B6B' : '#aaa', margin: '8px 0 0' }}>사진 추가하기</p><p style={{ fontSize: '12px', color: '#ccc', margin: '4px 0 0' }}>탭해서 사진 선택</p></>)}
            </div>
            {errors.image && <p style={{ fontSize: '12px', color: '#FF6B6B', margin: '6px 0 0' }}>⚠ {errors.image}</p>}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>뭐가 있어요? <span style={{ color: '#FF6B6B' }}>*</span></label>
            <input type="text" placeholder="예) 피카츄 인형, 산리오 가챠" value={title} onChange={(e) => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: undefined })) }} style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${errors.title ? '#FF6B6B' : title ? '#FF6B6B' : '#f0f0f0'}`, fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box' }} />
            {errors.title && <p style={{ fontSize: '12px', color: '#FF6B6B', margin: '6px 0 0' }}>⚠ {errors.title}</p>}
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>업체 위치 <span style={{ color: '#FF6B6B' }}>*</span></label>
            {location ? (
              <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #FF6B6B', backgroundColor: '#FFF5F5', position: 'relative' }}>
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#222', margin: '0 0 2px', paddingRight: '32px' }}>{location}</p>
                {locationDetail && <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{locationDetail}</p>}
                <button onClick={() => { setLocation(''); setLocationDetail(''); setLocationLat(null); setLocationLng(null); setLocationPlaceName('') }} style={{ position: 'absolute', top: '10px', right: '10px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#f0f0f0', color: '#888', fontSize: '12px', border: 'none', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowMapSearch(true)} style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${errors.location ? '#FF6B6B' : '#f0f0f0'}`, fontSize: '14px', backgroundColor: '#fafafa', cursor: 'pointer', textAlign: 'left', color: '#aaa', display: 'flex', alignItems: 'center', gap: '8px' }}><span>🔍</span> 업체명으로 검색하기</button>
            )}
            {errors.location && <p style={{ fontSize: '12px', color: '#FF6B6B', margin: '6px 0 0' }}>⚠ {errors.location}</p>}
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>태그 <span style={{ fontSize: '11px', color: '#aaa', fontWeight: '400' }}>선택</span></label>
            <input type="text" placeholder="#피카츄 #포켓몬" value={tags} onChange={(e) => setTags(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box' }} />
          </div>
        </main>
        {showMapSearch && <KakaoPlaceSearch onSelect={handlePlaceSelect} onClose={() => setShowMapSearch(false)} />}
      </div>
    )
  }

  // 메인 화면
  return (
    <div style={{ maxWidth: '430px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
      <header style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#FF6B6B', margin: 0 }}>🧸 뽑뽑</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user && <button onClick={() => { setChatRoomId(null); setShowChat(true) }} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer' }}>💬</button>}
          {user ? (
            <>
              <button onClick={() => setShowMyPage(true)} style={{ fontSize: '13px', color: '#FF6B6B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>{user.nickname}</button>
              <button onClick={handleLogout} style={{ fontSize: '12px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer' }}>로그아웃</button>
            </>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px', backgroundColor: '#f5f5f5' }}>로그인</button>
          )}
        </div>
      </header>

      {activeTab === 0 && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <input type="text" placeholder="🔍  인형 이름, 업체명으로 검색" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #f0f0f0', backgroundColor: '#fafafa', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      )}

      {activeTab === 0 ? (
        <main style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>불러오는 중... 🔄</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>{search ? '검색 결과가 없어요 😢' : '아직 제보가 없어요. 첫 번째로 제보해보세요! 🎯'}</p>
          ) : (
            filtered.map(item => (
              <div key={item.id} onClick={() => setSelectedPost(item)} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '12px', border: '1px solid #f0f0f0', cursor: 'pointer' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '12px', backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
                  {item.image_url ? <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '28px' }}>🧸</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#222', margin: '0 0 4px' }}>{item.title}</p>
                  {item.location && <p style={{ fontSize: '12px', color: '#888', margin: '0 0 2px' }}>📍 {item.location}</p>}
                  {item.tags && <p style={{ fontSize: '11px', color: '#FF6B6B', margin: '0 0 2px' }}>{item.tags}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '11px', color: '#bbb', margin: 0 }}>{item.nickname ?? '익명'} · {timeAgo(item.created_at)}</p>
                    <span style={{ fontSize: '11px', color: '#bbb' }}>👁️ {item.view_count ?? 0}</span>
                    <span style={{ fontSize: '11px', color: '#bbb' }}>❤️ {item.like_count ?? 0}</span>
                    <span style={{ fontSize: '11px', color: '#bbb' }}>💬 {item.comment_count ?? 0}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </main>
      ) : activeTab === 1 ? (
        <MapTab onSelectPost={(post) => setSelectedPost(post as Post)} />
      ) : activeTab === 2 ? (
        <MarketTab user={user} onRequireAuth={() => setShowAuth(true)} />
      ) : activeTab === 3 ? (
        <FeedTab user={user} onRequireAuth={() => setShowAuth(true)} />
      ) : null}

      {activeTab === 0 && (
        <button onClick={() => { if (!user) { setShowAuth(true); return }; setShowForm(true) }} style={{ position: 'fixed', bottom: '72px', right: 'calc(50% - 215px + 20px)', width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#FF6B6B', color: '#fff', fontSize: '24px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,107,107,0.4)' }}>+</button>
      )}

      <nav style={{ borderTop: '1px solid #f0f0f0', display: 'flex', backgroundColor: '#fff', flexShrink: 0 }}>
        {[{ icon: '🔍', label: '검색' }, { icon: '🗺️', label: '지도' }, { icon: '🛍️', label: '마켓' }, { icon: '📸', label: '피드' }].map((item, i) => (
          <button key={item.label} onClick={() => setActiveTab(i)} style={{ flex: 1, padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontSize: '11px', color: activeTab === i ? '#FF6B6B' : '#888', fontWeight: activeTab === i ? '600' : '400' }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {showChat && user && <ChatList user={user} initialRoomId={chatRoomId} onClose={() => { setShowChat(false); setChatRoomId(null) }} />}
      {showMyPage && user && <MyPage user={user} onClose={() => setShowMyPage(false)} onSelectPost={(post) => { setShowMyPage(false); setSelectedPost(post) }} />}
      {showAuth && <Auth onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />}
    </div>
  )
}