'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User, MarketItem } from '@/lib/types'
import { timeAgo, formatPrice, tradeTypeText, marketStatus } from '@/lib/utils'
import { notify } from '@/lib/social'
import { Header, BackButton, IconButton, Avatar, Button, Input, Field, Badge, Stat, EmptyState } from '@/components/ui'
import { MultiImageUploader, ImageSlot, uploadImages } from '@/components/MultiImageUploader'
import { ImageGallery } from '@/components/ImageGallery'
import { ReportSheet } from '@/components/ReportSheet'

type Props = { user: User | null; onRequireAuth: () => void }

export default function MarketTab({ user, onRequireAuth }: Props) {
  const [items, setItems] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<MarketItem | null>(null)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('market_items').select('*').order('created_at', { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }

  const filtered = items.filter(i => i.title.includes(search))

  if (selected) {
    return <MarketDetail item={selected} user={user} onBack={() => { setSelected(null); fetchItems() }} onRequireAuth={onRequireAuth} />
  }
  if (showForm && user) {
    return <MarketForm user={user} onClose={() => setShowForm(false)} onSubmitted={() => { setShowForm(false); fetchItems() }} />
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px' }}>🔍</span>
          <input placeholder="찾는 인형을 검색해보세요" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: 'var(--r-full)', border: 'none', background: 'var(--surface-2)', fontSize: '14.5px', outline: 'none', boxSizing: 'border-box', color: 'var(--ink)' }} />
        </div>
      </div>

      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-md)' }} />
                <div className="skeleton" style={{ width: '80%', height: '13px', marginTop: '8px' }} />
                <div className="skeleton" style={{ width: '50%', height: '13px', marginTop: '6px' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          search
            ? <EmptyState emoji="🔍" title="검색 결과가 없어요" desc="다른 키워드로 찾아보세요" />
            : <EmptyState emoji="🛍️" title="아직 상품이 없어요" desc="안 쓰는 인형을 나누거나 팔아보세요!" action={<Button onClick={() => { if (!user) { onRequireAuth(); return }; setShowForm(true) }}>+ 첫 상품 올리기</Button>} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {filtered.map(item => {
              const badge = marketStatus(item.status)
              return (
                <div key={item.id} onClick={() => openDetail(item, setSelected)} className="pressable" style={{ cursor: 'pointer' }}>
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--surface-2)', position: 'relative' }}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', opacity: 0.5 }}>🧸</div>}
                    {item.status !== 'selling' && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,21,35,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>{badge.text}</span>
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', margin: '9px 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: item.is_free ? 'var(--success)' : 'var(--ink)', margin: '0 0 5px' }}>{formatPrice(item.price, item.is_free)}</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Stat icon="❤️" value={item.like_count} />
                    <Stat icon="👁" value={item.view_count} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <button onClick={() => { if (!user) { onRequireAuth(); return }; setShowForm(true) }} className="pressable" style={{ position: 'absolute', bottom: 'calc(var(--nav-h) + 16px)', right: '18px', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--coral)', color: '#fff', fontSize: '28px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-coral)', zIndex: 40 }}>+</button>
    </div>
  )
}

async function openDetail(item: MarketItem, setSelected: (i: MarketItem) => void) {
  await supabase.from('market_items').update({ view_count: item.view_count + 1 }).eq('id', item.id)
  setSelected(item)
}

function MarketDetail({ item, user, onBack, onRequireAuth }: { item: MarketItem; user: User | null; onBack: () => void; onRequireAuth: () => void }) {
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [myLiked, setMyLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(item.like_count)
  const [status, setStatus] = useState(item.status)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const isMine = user?.id === item.user_id
  const badge = marketStatus(status)
  const gallery = (item.images && item.images.length > 0) ? item.images : (item.image_url ? [item.image_url] : [])

  useEffect(() => {
    supabase.from('market_likes').select('*').eq('item_id', item.id).then(({ data }) => {
      if (data) { setLikeCount(data.length); if (user) setMyLiked(data.some(l => l.user_id === user.id)) }
    })
    supabase.from('market_comments').select('*').eq('item_id', item.id).order('created_at', { ascending: true }).then(({ data }) => {
      if (data) setComments(data)
    })
  }, [item.id])

  async function handleLike() {
    if (!user) { onRequireAuth(); return }
    if (myLiked) {
      await supabase.from('market_likes').delete().eq('item_id', item.id).eq('user_id', user.id)
      const c = likeCount - 1
      await supabase.from('market_items').update({ like_count: c }).eq('id', item.id)
      setMyLiked(false); setLikeCount(c)
    } else {
      const { error } = await supabase.from('market_likes').insert({ item_id: item.id, user_id: user.id })
      if (!error) {
        const c = likeCount + 1
        await supabase.from('market_items').update({ like_count: c }).eq('id', item.id)
        setMyLiked(true); setLikeCount(c)
        notify({ userId: item.user_id, actorId: user.id, actorNickname: user.nickname, type: 'market_like', targetType: 'market', targetId: item.id, targetTitle: item.title })
      }
    }
  }

  async function handleComment() {
    if (!user) { onRequireAuth(); return }
    if (!newComment.trim()) return
    const { error } = await supabase.from('market_comments').insert({ item_id: item.id, user_id: user.id, nickname: user.nickname, content: newComment.trim() })
    if (!error) {
      setNewComment('')
      const { data } = await supabase.from('market_comments').select('*').eq('item_id', item.id).order('created_at', { ascending: true })
      if (data) setComments(data)
    }
  }

  async function changeStatus(s: string) {
    await supabase.from('market_items').update({ status: s }).eq('id', item.id)
    setStatus(s)
  }

  async function handleDelete() {
    if (!confirm('이 상품을 삭제할까요? 되돌릴 수 없어요.')) return
    await supabase.from('market_items').delete().eq('id', item.id)
    onBack()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <Header
        left={<BackButton onClick={onBack} />}
        title="상품 상세"
        right={
          isMine ? (
            <div style={{ position: 'relative' }}>
              <IconButton onClick={() => setMenuOpen(!menuOpen)}>⋯</IconButton>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                  <div style={{ position: 'absolute', top: '42px', right: 0, background: 'var(--surface)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', zIndex: 31, overflow: 'hidden', minWidth: '130px' }}>
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
        {gallery.length > 0 && (
          <div style={{ position: 'relative' }}>
            <ImageGallery images={gallery} />
            <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
              <Badge color={badge.color} bg={badge.bg}>{badge.text}</Badge>
            </div>
          </div>
        )}

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 8px', lineHeight: 1.3 }}>{item.title}</h1>
            <p style={{ fontSize: '24px', fontWeight: 800, color: item.is_free ? 'var(--success)' : 'var(--ink)', margin: 0 }}>{formatPrice(item.price, item.is_free)}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px' }}>
              <Stat icon="👁" value={item.view_count} />
              <Stat icon="❤️" value={likeCount} />
              <Stat icon="💬" value={comments.length} />
              <Stat icon="🚚" value={tradeTypeText(item.trade_type)} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'var(--surface)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)' }}>
            <Avatar name={item.nickname} />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px' }}>{item.nickname ?? '익명'}</p>
              <p style={{ fontSize: '12px', color: 'var(--ink-4)', margin: 0 }}>{timeAgo(item.created_at)}</p>
            </div>
          </div>

          {item.description && (
            <p style={{ fontSize: '14.5px', color: 'var(--ink-2)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{item.description}</p>
          )}

          {isMine && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {['selling', 'reserved', 'sold'].map(s => {
                const b = marketStatus(s)
                return (
                  <button key={s} onClick={() => changeStatus(s)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--r-md)', border: status === s ? `1.5px solid ${b.color}` : '1.5px solid var(--line)', background: status === s ? b.bg : 'var(--surface)', color: status === s ? b.color : 'var(--ink-3)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{b.text}</button>
                )
              })}
            </div>
          )}

          <Button full size="lg" variant={myLiked ? 'primary' : 'soft'} onClick={handleLike}>
            {myLiked ? '🧡 찜했어요' : '🤍 찜하기'} {likeCount > 0 && likeCount}
          </Button>

          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px' }}>문의 {comments.length > 0 && <span style={{ color: 'var(--coral)' }}>{comments.length}</span>}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {comments.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--ink-4)', textAlign: 'center', padding: '24px 0' }}>판매자에게 궁금한 걸 물어보세요 😊</p>
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
        <Input placeholder={user ? '문의하기...' : '로그인 후 문의'} value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleComment()} style={{ flex: 1, padding: '11px 14px' }} />
        <Button onClick={handleComment} disabled={!newComment.trim()} variant={newComment.trim() ? 'primary' : 'outline'} style={{ flexShrink: 0 }}>등록</Button>
      </div>

      {showReport && (
        <ReportSheet user={user} targetType="market" targetId={item.id} targetUserId={item.user_id} targetNickname={item.nickname} onClose={() => setShowReport(false)} onRequireAuth={onRequireAuth} onDone={(msg) => { setShowReport(false); alert(msg) }} />
      )}
    </div>
  )
}

function MarketForm({ user, onClose, onSubmitted }: { user: User; onClose: () => void; onSubmitted: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [tradeType, setTradeType] = useState('both')
  const [images, setImages] = useState<ImageSlot[]>([])
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<{ image?: string; title?: string; price?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (images.length === 0) e.image = '사진을 추가해주세요'
    if (!title.trim()) e.title = '제목을 입력해주세요'
    if (!isFree && !price.trim()) e.price = '가격을 입력하거나 나눔을 선택해주세요'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setUploading(true)
    const urls = await uploadImages(supabase, images, 'market_')
    const { error } = await supabase.from('market_items').insert({
      title, description, price: isFree ? 0 : parseInt(price) || 0, is_free: isFree,
      trade_type: tradeType, image_url: urls[0] ?? null, images: urls,
      user_id: user.id, nickname: user.nickname,
    })
    setUploading(false)
    if (!error) onSubmitted()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <Header
        left={<button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '14px', color: 'var(--ink-3)', cursor: 'pointer', padding: '8px' }}>취소</button>}
        title="상품 등록"
        right={<Button size="sm" onClick={handleSubmit} disabled={uploading}>{uploading ? '올리는 중' : '등록'}</Button>}
      />
      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Field label="사진" required error={errors.image}>
          <MultiImageUploader images={images} onChange={(imgs) => { setImages(imgs); setErrors(p => ({ ...p, image: undefined })) }} max={5} error={!!errors.image} />
        </Field>
        <Field label="제목" required error={errors.title}>
          <Input placeholder="예) 피카츄 봉제인형 (중) 팔아요" value={title} error={!!errors.title} onChange={(e) => { setTitle(e.target.value); setErrors(p => ({ ...p, title: undefined })) }} />
        </Field>
        <Field label="가격" required error={errors.price}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input type="number" placeholder="가격 입력" value={price} error={!!errors.price} disabled={isFree} onChange={(e) => { setPrice(e.target.value); setErrors(p => ({ ...p, price: undefined })) }} style={{ flex: 1, background: isFree ? 'var(--surface-3)' : 'var(--surface)' }} />
            <button onClick={() => { setIsFree(!isFree); setPrice(''); setErrors(p => ({ ...p, price: undefined })) }} style={{ padding: '0 18px', borderRadius: 'var(--r-md)', border: `1.5px solid ${isFree ? 'var(--success)' : 'var(--line)'}`, background: isFree ? 'var(--mint-soft)' : 'var(--surface)', color: isFree ? 'var(--success)' : 'var(--ink-3)', fontSize: '14px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>나눔 💝</button>
          </div>
        </Field>
        <Field label="거래 방식">
          <div style={{ display: 'flex', gap: '6px' }}>
            {[{ v: 'both', t: '직거래·택배' }, { v: 'direct', t: '직거래' }, { v: 'delivery', t: '택배' }, { v: 'exchange', t: '교환' }].map(opt => (
              <button key={opt.v} onClick={() => setTradeType(opt.v)} style={{ flex: 1, padding: '11px 4px', borderRadius: 'var(--r-md)', border: tradeType === opt.v ? '1.5px solid var(--coral)' : '1.5px solid var(--line)', background: tradeType === opt.v ? 'var(--coral-soft)' : 'var(--surface)', color: tradeType === opt.v ? 'var(--coral)' : 'var(--ink-3)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{opt.t}</button>
            ))}
          </div>
        </Field>
        <Field label="설명" optional>
          <textarea placeholder="상품 상태, 거래 희망 장소 등을 적어주세요" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: '13px 15px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', fontSize: '14.5px', outline: 'none', minHeight: '110px', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />
        </Field>
      </main>
    </div>
  )
}
