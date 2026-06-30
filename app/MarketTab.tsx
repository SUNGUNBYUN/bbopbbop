'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type MarketItem = {
  id: string
  title: string
  description: string | null
  price: number | null
  is_free: boolean
  trade_type: string
  image_url: string | null
  status: string
  user_id: string
  nickname: string | null
  location: string | null
  view_count: number
  like_count: number
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

export default function MarketTab({ user, onRequireAuth }: Props) {
  const [items, setItems] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MarketItem | null>(null)

  // 등록 폼 상태
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [tradeType, setTradeType] = useState('both')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<{ image?: string; title?: string; price?: string }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 상세 화면 상태
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [myLiked, setMyLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('market_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setErrors(prev => ({ ...prev, image: undefined }))
  }

  function handleImageRemove(e: React.MouseEvent) {
    e.stopPropagation()
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function validate() {
    const newErrors: { image?: string; title?: string; price?: string } = {}
    if (!imageFile) newErrors.image = '사진을 추가해주세요'
    if (!title.trim()) newErrors.title = '제목을 입력해주세요'
    if (!isFree && !price.trim()) newErrors.price = '가격을 입력하거나 나눔을 선택해주세요'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!user) { onRequireAuth(); return }
    if (!validate()) return
    setUploading(true)

    let image_url = null
    if (imageFile) {
      const fileName = `market_${Date.now()}_${imageFile.name}`
      const { data, error } = await supabase.storage.from('images').upload(fileName, imageFile)
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('images').getPublicUrl(data.path)
        image_url = urlData.publicUrl
      }
    }

    const { error } = await supabase.from('market_items').insert({
      title,
      description,
      price: isFree ? 0 : parseInt(price) || 0,
      is_free: isFree,
      trade_type: tradeType,
      image_url,
      user_id: user.id,
      nickname: user.nickname,
    })

    if (!error) {
      setTitle(''); setDescription(''); setPrice(''); setIsFree(false); setTradeType('both')
      setImageFile(null); setImagePreview(null); setErrors({})
      setShowForm(false)
      fetchItems()
    }
    setUploading(false)
  }

  async function openDetail(item: MarketItem) {
    setSelectedItem(item)
    // 조회수 증가
    await supabase.from('market_items').update({ view_count: item.view_count + 1 }).eq('id', item.id)
    // 좋아요 확인
    const { data: likesData } = await supabase.from('market_likes').select('*').eq('item_id', item.id)
    if (likesData) {
      setLikeCount(likesData.length)
      if (user) setMyLiked(likesData.some(l => l.user_id === user.id))
    }
    // 댓글 불러오기
    const { data: commentsData } = await supabase
      .from('market_comments').select('*').eq('item_id', item.id)
      .order('created_at', { ascending: true })
    if (commentsData) setComments(commentsData)
  }

  async function handleLike() {
    if (!user) { onRequireAuth(); return }
    if (!selectedItem) return

    if (myLiked) {
      await supabase.from('market_likes').delete().eq('item_id', selectedItem.id).eq('user_id', user.id)
      const newCount = likeCount - 1
      await supabase.from('market_items').update({ like_count: newCount }).eq('id', selectedItem.id)
      setMyLiked(false)
      setLikeCount(newCount)
    } else {
      const { error } = await supabase.from('market_likes').insert({ item_id: selectedItem.id, user_id: user.id })
      if (!error) {
        const newCount = likeCount + 1
        await supabase.from('market_items').update({ like_count: newCount }).eq('id', selectedItem.id)
        setMyLiked(true)
        setLikeCount(newCount)
      }
    }
  }

  async function handleComment() {
    if (!user) { onRequireAuth(); return }
    if (!selectedItem || !newComment.trim()) return

    const { error } = await supabase.from('market_comments').insert({
      item_id: selectedItem.id,
      user_id: user.id,
      nickname: user.nickname,
      content: newComment.trim()
    })

    if (!error) {
      setNewComment('')
      const { data } = await supabase
        .from('market_comments').select('*').eq('item_id', selectedItem.id)
        .order('created_at', { ascending: true })
      if (data) setComments(data)
    }
  }

  async function handleStatusChange(status: string) {
    if (!selectedItem) return
    await supabase.from('market_items').update({ status }).eq('id', selectedItem.id)
    setSelectedItem({ ...selectedItem, status })
    fetchItems()
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
    if (status === 'reserved') return { text: '예약중', color: '#F49719', bg: '#FFF6E9' }
    if (status === 'sold') return { text: '거래완료', color: '#888', bg: '#f5f5f5' }
    return { text: '판매중', color: '#FF6B6B', bg: '#FFF5F5' }
  }

  function tradeTypeText(type: string) {
    if (type === 'direct') return '직거래'
    if (type === 'delivery') return '택배'
    if (type === 'exchange') return '교환'
    return '직거래/택배'
  }

  const filtered = items.filter(i => i.title.includes(search))

  // 상세 화면
  if (selectedItem) {
    const badge = statusBadge(selectedItem.status)
    const isMine = user?.id === selectedItem.user_id

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => setSelectedItem(null)} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>←</button>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0, flex: 1 }}>상품 상세</h2>
        </div>

        <main style={{ flex: 1, overflowY: 'auto' }}>
          {selectedItem.image_url && (
            <div style={{ position: 'relative' }}>
              <img src={selectedItem.image_url} alt={selectedItem.title} style={{ width: '100%', height: '280px', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: badge.bg, color: badge.color, fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>
                {badge.text}
              </div>
            </div>
          )}

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#222', margin: '0 0 8px' }}>{selectedItem.title}</h3>
              <p style={{ fontSize: '22px', fontWeight: '800', color: selectedItem.is_free ? '#27500A' : '#222', margin: 0 }}>{priceText(selectedItem)}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#bbb' }}>👁️ {selectedItem.view_count}</span>
              <span style={{ fontSize: '12px', color: '#bbb' }}>❤️ {likeCount}</span>
              <span style={{ fontSize: '12px', color: '#bbb' }}>💬 {comments.length}</span>
              <span style={{ fontSize: '12px', color: '#bbb' }}>🚚 {tradeTypeText(selectedItem.trade_type)}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#fafafa', borderRadius: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FF6B6B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '700', flexShrink: 0 }}>
                {(selectedItem.nickname ?? '익명')[0]}
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#222', margin: '0 0 2px' }}>{selectedItem.nickname ?? '익명'}</p>
                <p style={{ fontSize: '11px', color: '#aaa', margin: 0 }}>{timeAgo(selectedItem.created_at)}</p>
              </div>
            </div>

            {selectedItem.description && (
              <p style={{ fontSize: '14px', color: '#444', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>{selectedItem.description}</p>
            )}

            {/* 판매자 본인이면 상태 변경 */}
            {isMine && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {['selling', 'reserved', 'sold'].map(s => {
                  const b = statusBadge(s)
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', border: selectedItem.status === s ? `1.5px solid ${b.color}` : '1px solid #f0f0f0', backgroundColor: selectedItem.status === s ? b.bg : '#fff', color: selectedItem.status === s ? b.color : '#888', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >{b.text}</button>
                  )
                })}
              </div>
            )}

            {/* 좋아요(찜) 버튼 */}
            <button
              onClick={handleLike}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: myLiked ? '#FF6B6B' : '#FFF5F5', color: myLiked ? '#fff' : '#FF6B6B', border: '1.5px solid #FF6B6B', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}
            >
              {myLiked ? '❤️ 찜했어요!' : '🤍 찜하기'} {likeCount > 0 && `(${likeCount})`}
            </button>

            {/* 댓글(문의) */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#222', margin: '0 0 12px' }}>문의 {comments.length > 0 && `(${comments.length})`}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {comments.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#bbb', textAlign: 'center', padding: '20px 0' }}>판매자에게 궁금한 점을 물어보세요 😊</p>
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
                  placeholder={user ? '문의하기...' : '로그인 후 문의할 수 있어요'}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '13px', outline: 'none', backgroundColor: '#fafafa' }}
                />
                <button
                  onClick={handleComment}
                  disabled={!newComment.trim()}
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
          <button onClick={() => { setShowForm(false); setImagePreview(null); setImageFile(null); setErrors({}) }} style={{ fontSize: '14px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>취소</button>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>상품 등록</h2>
          <button onClick={handleSubmit} disabled={uploading} style={{ fontSize: '14px', color: '#fff', fontWeight: '600', background: '#FF6B6B', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: '20px', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? '올리는 중...' : '등록'}
          </button>
        </div>

        <main style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 사진 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>사진 <span style={{ color: '#FF6B6B' }}>*</span></label>
            <div onClick={() => fileInputRef.current?.click()} style={{ width: '100%', height: '200px', borderRadius: '16px', border: errors.image ? '2px dashed #FF6B6B' : imagePreview ? 'none' : '2px dashed #f0f0f0', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="미리보기" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={handleImageRemove} style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '14px', border: 'none', cursor: 'pointer' }}>✕</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '36px' }}>📷</span>
                  <p style={{ fontSize: '14px', color: errors.image ? '#FF6B6B' : '#aaa', margin: '8px 0 0' }}>사진 추가하기</p>
                </>
              )}
            </div>
            {errors.image && <p style={{ fontSize: '12px', color: '#FF6B6B', margin: '6px 0 0' }}>⚠ {errors.image}</p>}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
          </div>

          {/* 제목 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>제목 <span style={{ color: '#FF6B6B' }}>*</span></label>
            <input
              type="text"
              placeholder="예) 피카츄 봉제인형 (중) 팔아요"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: undefined })) }}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${errors.title ? '#FF6B6B' : '#f0f0f0'}`, fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box' }}
            />
            {errors.title && <p style={{ fontSize: '12px', color: '#FF6B6B', margin: '6px 0 0' }}>⚠ {errors.title}</p>}
          </div>

          {/* 가격 / 나눔 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>가격 <span style={{ color: '#FF6B6B' }}>*</span></label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                placeholder="가격 입력"
                value={price}
                onChange={(e) => { setPrice(e.target.value); setErrors(prev => ({ ...prev, price: undefined })) }}
                disabled={isFree}
                style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${errors.price ? '#FF6B6B' : '#f0f0f0'}`, fontSize: '14px', outline: 'none', backgroundColor: isFree ? '#f0f0f0' : '#fafafa', boxSizing: 'border-box' }}
              />
              <button
                onClick={() => { setIsFree(!isFree); setPrice(''); setErrors(prev => ({ ...prev, price: undefined })) }}
                style={{ padding: '12px 16px', borderRadius: '10px', border: `1.5px solid ${isFree ? '#FF6B6B' : '#f0f0f0'}`, backgroundColor: isFree ? '#FFF5F5' : '#fafafa', color: isFree ? '#FF6B6B' : '#888', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >나눔💝</button>
            </div>
            {errors.price && <p style={{ fontSize: '12px', color: '#FF6B6B', margin: '6px 0 0' }}>⚠ {errors.price}</p>}
          </div>

          {/* 거래 방식 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>거래 방식</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[{ v: 'both', t: '직거래+택배' }, { v: 'direct', t: '직거래만' }, { v: 'delivery', t: '택배만' }, { v: 'exchange', t: '교환' }].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setTradeType(opt.v)}
                  style={{ flex: 1, padding: '10px 4px', borderRadius: '10px', border: tradeType === opt.v ? '1.5px solid #FF6B6B' : '1px solid #f0f0f0', backgroundColor: tradeType === opt.v ? '#FFF5F5' : '#fff', color: tradeType === opt.v ? '#FF6B6B' : '#888', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                >{opt.t}</button>
              ))}
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>설명 <span style={{ fontSize: '11px', color: '#aaa', fontWeight: '400' }}>선택</span></label>
            <textarea
              placeholder="상품 상태, 거래 희망 장소 등을 적어주세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box', height: '100px', resize: 'none', fontFamily: 'inherit' }}
            />
          </div>
        </main>
      </div>
    )
  }

  // 목록 화면
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="🔍  찾는 인형을 검색해보세요"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #f0f0f0', backgroundColor: '#fafafa', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <main style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {loading ? (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>불러오는 중... 🔄</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#aaa', textAlign: 'center', marginTop: '40px' }}>
            {search ? '검색 결과가 없어요 😢' : '아직 등록된 상품이 없어요. 첫 상품을 올려보세요! 🛍️'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {filtered.map(item => {
              const badge = statusBadge(item.status)
              return (
                <div key={item.id} onClick={() => openDetail(item)} style={{ borderRadius: '14px', border: '1px solid #f0f0f0', overflow: 'hidden', cursor: 'pointer' }}>
                  <div style={{ width: '100%', height: '120px', backgroundColor: '#fafafa', position: 'relative' }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>🧸</div>
                    )}
                    {item.status !== 'selling' && (
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>{badge.text}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#222', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                    <p style={{ fontSize: '13px', fontWeight: '800', color: item.is_free ? '#27500A' : '#222', margin: '0 0 4px' }}>{priceText(item)}</p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#bbb' }}>❤️ {item.like_count}</span>
                      <span style={{ fontSize: '10px', color: '#bbb' }}>👁️ {item.view_count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <button
        onClick={() => { if (!user) { onRequireAuth(); return }; setShowForm(true) }}
        style={{ position: 'fixed', bottom: '72px', right: 'calc(50% - 215px + 20px)', width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#FF6B6B', color: '#fff', fontSize: '24px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,107,107,0.4)' }}
      >+</button>
    </div>
  )
}