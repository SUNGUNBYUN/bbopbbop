'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User, MarketItem, Place } from '@/lib/types'
import { timeAgo, formatPrice, tradeTypeText, marketStatus } from '@/lib/utils'
import { notify } from '@/lib/social'
import { bumpMarketItem, boostMarketItem, isActive, PIN_COST, HIGHLIGHT_COST } from '@/lib/points'
import { Header, BackButton, IconButton, Avatar, Button, Input, Field, Badge, Stat, EmptyState } from '@/components/ui'
import { MultiImageUploader, ImageSlot, uploadImages } from '@/components/MultiImageUploader'
import { ImageGallery } from '@/components/ImageGallery'
import { ReportSheet } from '@/components/ReportSheet'
import { PlaceSearchSheet } from '@/components/PlaceSearchSheet'
import { PlaceMapView } from '@/components/PlaceMapView'

type OpenChat = (otherId: string, otherNickname: string | null, sourceType: 'post' | 'market' | 'feed', sourceId: string, sourceTitle: string | null) => void
type Props = { user: User | null; onRequireAuth: () => void; onOpenChat: OpenChat }

/** 끌어올리기 1회 비용(포인트) */
const BUMP_COST = 20

export default function MarketTab({ user, onRequireAuth, onOpenChat }: Props) {
  const [items, setItems] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MarketItem | null>(null)
  const [selected, setSelected] = useState<MarketItem | null>(null)
  const [mapPlace, setMapPlace] = useState<MarketItem | null>(null)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase.from('market_items').select('*')
    if (data) {
      // 상단 고정이 먼저, 그 다음 끌어올린 시각(없으면 등록 시각) 기준 최신순
      const sorted = [...data].sort((a, b) => {
        const pa = isActive(a.pinned_until) ? 1 : 0
        const pb = isActive(b.pinned_until) ? 1 : 0
        if (pa !== pb) return pb - pa
        return new Date(b.bumped_at ?? b.created_at).getTime() - new Date(a.bumped_at ?? a.created_at).getTime()
      })
      setItems(sorted)
    }
    setLoading(false)
  }

  const filtered = items.filter(i => i.title.includes(search))

  if (selected) {
    return <MarketDetail item={selected} user={user} onBack={() => { setSelected(null); fetchItems() }} onEdit={() => { setEditing(selected); setSelected(null) }} onRequireAuth={onRequireAuth} onOpenChat={onOpenChat} />
  }
  if ((showForm || editing) && user) {
    return <MarketForm user={user} editing={editing} onClose={() => { setShowForm(false); setEditing(null) }} onSubmitted={() => { setShowForm(false); setEditing(null); fetchItems() }} />
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
                <div key={item.id} onClick={() => openDetail(item, setSelected)} className="pressable" style={{ cursor: 'pointer', background: 'var(--surface)', borderRadius: 'var(--r-md)', overflow: 'hidden', boxShadow: isActive(item.highlight_until) ? '0 0 0 2px var(--coral)' : 'var(--shadow-sm)' }}>
                  <div style={{ width: '100%', aspectRatio: '1', overflow: 'hidden', background: 'var(--surface-2)', position: 'relative' }}>
                    {isActive(item.pinned_until) && (
                      <div style={{ position: 'absolute', top: '6px', left: '6px', zIndex: 2, fontSize: '10px', fontWeight: 800, color: '#fff', background: 'var(--coral)', padding: '3px 7px', borderRadius: 'var(--r-full)' }}>📌 고정</div>
                    )}
                    {item.image_url
                      ? <img src={item.image_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', opacity: 0.5 }}>🧸</div>}
                    {item.status !== 'selling' && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,21,35,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>{badge.text}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '9px 10px 11px' }}>
                    <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: item.is_free ? 'var(--success)' : 'var(--ink)', margin: '0 0 6px' }}>{formatPrice(item.price, item.is_free)}</p>
                    {item.place_name && (
                      item.latitude != null && item.longitude != null ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setMapPlace(item) }}
                          style={{ background: 'none', border: 'none', padding: 0, margin: '0 0 6px', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left' }}
                        >
                          <p style={{ fontSize: '11.5px', color: 'var(--coral)', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📍 {item.place_name} ›</p>
                        </button>
                      ) : (
                        <p style={{ fontSize: '11.5px', color: 'var(--coral)', fontWeight: 700, margin: '0 0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📍 {item.place_name}</p>
                      )
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Stat icon="❤️" value={item.like_count} />
                      <Stat icon="👁" value={item.view_count} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <button onClick={() => { if (!user) { onRequireAuth(); return }; setShowForm(true) }} className="pressable" style={{ position: 'absolute', bottom: 'calc(var(--nav-h) + 16px)', right: '18px', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--coral)', color: '#fff', fontSize: '28px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-coral)', zIndex: 40 }}>+</button>

      {mapPlace && mapPlace.place_name && mapPlace.latitude != null && mapPlace.longitude != null && (
        <PlaceMapView
          name={mapPlace.place_name}
          address={mapPlace.location}
          lat={mapPlace.latitude}
          lng={mapPlace.longitude}
          onClose={() => setMapPlace(null)}
        />
      )}
    </div>
  )
}

async function openDetail(item: MarketItem, setSelected: (i: MarketItem) => void) {
  await supabase.rpc('increment_market_view', { item_id: item.id })
  setSelected(item)
}

function MarketDetail({ item, user, onBack, onEdit, onRequireAuth, onOpenChat }: { item: MarketItem; user: User | null; onBack: () => void; onEdit: () => void; onRequireAuth: () => void; onOpenChat: OpenChat }) {
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [myLiked, setMyLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(item.like_count)
  const [status, setStatus] = useState(item.status)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [chatCount, setChatCount] = useState(0)
  const [bumping, setBumping] = useState(false)
  const [boosting, setBoosting] = useState(false)
  const [pinnedUntil, setPinnedUntil] = useState(item.pinned_until)
  const [highlightUntil, setHighlightUntil] = useState(item.highlight_until)
  const [showMap, setShowMap] = useState(false)
  const isMine = user?.id === item.user_id
  const badge = marketStatus(status)
  const gallery = (item.images && item.images.length > 0) ? item.images : (item.image_url ? [item.image_url] : [])

  useEffect(() => {
    supabase.from('market_likes').select('*').eq('item_id', item.id).then(({ data }) => {
      if (data) { setLikeCount(data.length); if (user) setMyLiked(data.some(l => l.user_id === user.id)) }
    })
    // 이 상품으로 시작된 채팅방 수
    supabase.from('chat_rooms').select('id', { count: 'exact', head: true })
      .eq('source_type', 'market').eq('source_id', item.id)
      .then(({ count }) => { if (count != null) setChatCount(count) })
  }, [item.id])

  async function handleLike() {
    if (!user) { onRequireAuth(); return }
    if (myLiked) {
      await supabase.from('market_likes').delete().eq('item_id', item.id).eq('user_id', user.id)
      const { data: c } = await supabase.rpc('sync_market_like_count', { p_item_id: item.id })
      setMyLiked(false); setLikeCount(typeof c === 'number' ? c : Math.max(0, likeCount - 1))
    } else {
      const { error } = await supabase.from('market_likes').insert({ item_id: item.id, user_id: user.id })
      if (!error) {
        const { data: c } = await supabase.rpc('sync_market_like_count', { p_item_id: item.id })
        setMyLiked(true); setLikeCount(typeof c === 'number' ? c : likeCount + 1)
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

  async function handleBump() {
    if (!user) { onRequireAuth(); return }
    if (!confirm(`${BUMP_COST}포인트로 이 상품을 목록 맨 위로 끌어올릴까요?`)) return
    setBumping(true)
    try {
      await bumpMarketItem(item.id, BUMP_COST)
      alert('맨 위로 끌어올렸어요! 🔝')
      onBack()
    } catch (e: any) {
      alert(e.message ?? '끌어올리기에 실패했어요')
    } finally {
      setBumping(false)
    }
  }

  async function handleBoost(kind: 'pin' | 'highlight') {
    if (!user) { onRequireAuth(); return }
    const cost = kind === 'pin' ? PIN_COST : HIGHLIGHT_COST
    const label = kind === 'pin' ? '상단 고정' : '강조 표시'
    if (!confirm(`${cost}포인트로 24시간 동안 ${label}할까요?`)) return
    setBoosting(true)
    try {
      const until = await boostMarketItem(item.id, kind)
      if (kind === 'pin') setPinnedUntil(until); else setHighlightUntil(until)
      alert(`${label} 적용됐어요!`)
    } catch (e: any) {
      alert(e.message ?? '설정에 실패했어요')
    } finally {
      setBoosting(false)
    }
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
              <Stat icon="💬" value={chatCount} />
              <Stat icon="🚚" value={tradeTypeText(item.trade_type)} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'var(--surface)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)' }}>
            <Avatar name={item.nickname} />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px' }}>{item.nickname ?? '익명'}</p>
              <p style={{ fontSize: '12px', color: 'var(--ink-4)', margin: 0 }}>{timeAgo(item.created_at)}{item.updated_at ? ' · 수정됨' : ''}</p>
            </div>
          </div>

          {item.place_name && (
            item.latitude != null && item.longitude != null ? (
              <button onClick={() => setShowMap(true)} className="pressable" style={{ background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ padding: '13px 14px', borderRadius: 'var(--r-md)', background: 'var(--coral-soft)', border: '1.5px solid var(--coral)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px' }}>📍 {item.place_name}</p>
                    {item.location && <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{item.location}</p>}
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--coral)', flexShrink: 0 }}>지도 보기 ›</span>
                </div>
              </button>
            ) : (
              <div style={{ padding: '13px 14px', borderRadius: 'var(--r-md)', background: 'var(--coral-soft)', border: '1.5px solid var(--coral)' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px' }}>📍 {item.place_name}</p>
                {item.location && <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{item.location}</p>}
              </div>
            )
          )}

          {item.description && (
            <p style={{ fontSize: '14.5px', color: 'var(--ink-2)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{item.description}</p>
          )}

          {isMine && (
            <>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['selling', 'reserved', 'sold'].map(s => {
                  const b = marketStatus(s)
                  return (
                    <button key={s} onClick={() => changeStatus(s)} style={{ flex: 1, padding: '11px', borderRadius: 'var(--r-md)', border: status === s ? `1.5px solid ${b.color}` : '1.5px solid var(--line)', background: status === s ? b.bg : 'var(--surface)', color: status === s ? b.color : 'var(--ink-3)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{b.text}</button>
                  )
                })}
              </div>
              <button
                onClick={handleBump}
                disabled={bumping}
                className="pressable"
                style={{ width: '100%', padding: '13px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--coral)', background: 'var(--coral-soft)', color: 'var(--coral)', fontSize: '14px', fontWeight: 700, cursor: bumping ? 'default' : 'pointer', opacity: bumping ? 0.6 : 1 }}
              >{bumping ? '끌어올리는 중…' : `🔝 끌어올리기 (${BUMP_COST}P)`}</button>

              {/* 노출 강화 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleBoost('pin')}
                  disabled={boosting}
                  className="pressable"
                  style={{ flex: 1, padding: '13px 8px', borderRadius: 'var(--r-md)', border: isActive(pinnedUntil) ? '1.5px solid var(--coral)' : '1.5px solid var(--line)', background: isActive(pinnedUntil) ? 'var(--coral-soft)' : 'var(--surface)', color: isActive(pinnedUntil) ? 'var(--coral)' : 'var(--ink-3)', fontSize: '13px', fontWeight: 700, cursor: boosting ? 'default' : 'pointer', opacity: boosting ? 0.6 : 1 }}
                >
                  📌 상단 고정 ({PIN_COST}P)
                  {isActive(pinnedUntil) && <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 600, marginTop: '2px' }}>적용 중</span>}
                </button>
                <button
                  onClick={() => handleBoost('highlight')}
                  disabled={boosting}
                  className="pressable"
                  style={{ flex: 1, padding: '13px 8px', borderRadius: 'var(--r-md)', border: isActive(highlightUntil) ? '1.5px solid var(--coral)' : '1.5px solid var(--line)', background: isActive(highlightUntil) ? 'var(--coral-soft)' : 'var(--surface)', color: isActive(highlightUntil) ? 'var(--coral)' : 'var(--ink-3)', fontSize: '13px', fontWeight: 700, cursor: boosting ? 'default' : 'pointer', opacity: boosting ? 0.6 : 1 }}
                >
                  ✨ 강조 ({HIGHLIGHT_COST}P)
                  {isActive(highlightUntil) && <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 600, marginTop: '2px' }}>적용 중</span>}
                </button>
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: '-8px 0 0', textAlign: 'center' }}>
                각 24시간 유지 · 중복 구매하면 시간이 이어져요
              </p>
            </>
          )}

          {/* 찜 + 채팅 버튼 (내 상품이 아닐 때만 채팅) */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button size="lg" variant={myLiked ? 'primary' : 'soft'} onClick={handleLike} style={{ flex: 1 }}>
              {myLiked ? '🧡 찜했어요' : '🤍 찜하기'} {likeCount > 0 && likeCount}
            </Button>
            {!isMine && (
              <Button size="lg" variant="mint" onClick={() => onOpenChat(item.user_id, item.nickname, 'market', item.id, item.title)} style={{ flex: 1 }}>
                💬 채팅하기
              </Button>
            )}
          </div>
        </div>
      </main>

      {showReport && (
        <ReportSheet user={user} targetType="market" targetId={item.id} targetUserId={item.user_id} targetNickname={item.nickname} onClose={() => setShowReport(false)} onRequireAuth={onRequireAuth} onDone={(msg) => { setShowReport(false); alert(msg) }} />
      )}

      {showMap && item.place_name && item.latitude != null && item.longitude != null && (
        <PlaceMapView name={item.place_name} address={item.location} lat={item.latitude} lng={item.longitude} onClose={() => setShowMap(false)} />
      )}
    </div>
  )
}

function MarketForm({ user, editing, onClose, onSubmitted }: { user: User; editing: MarketItem | null; onClose: () => void; onSubmitted: () => void }) {
  const isEdit = !!editing
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [price, setPrice] = useState(editing && !editing.is_free && editing.price ? String(editing.price) : '')
  const [isFree, setIsFree] = useState(editing?.is_free ?? false)
  const [tradeType, setTradeType] = useState(editing?.trade_type ?? 'both')
  // 수정 시 기존 사진(URL) / 새로 추가한 사진(File) 분리 관리
  const [keptUrls, setKeptUrls] = useState<string[]>(
    editing ? ((editing.images && editing.images.length > 0) ? editing.images : (editing.image_url ? [editing.image_url] : [])) : []
  )
  const [images, setImages] = useState<ImageSlot[]>([])
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<{ image?: string; title?: string; price?: string }>({})
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

  function validate() {
    const e: typeof errors = {}
    if (totalPhotos === 0) e.image = '사진을 추가해주세요'
    if (!title.trim()) e.title = '제목을 입력해주세요'
    if (!isFree && !price.trim()) e.price = '가격을 입력하거나 나눔을 선택해주세요'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setUploading(true)

    let newUrls: string[] = []
    if (images.length > 0) {
      try {
        newUrls = await uploadImages(supabase, images, 'market_')
      } catch (e: any) {
        setUploading(false)
        alert(e?.message ?? '사진 업로드에 실패했어요')
        return
      }
    }
    const allUrls = [...keptUrls, ...newUrls]

    const payload = {
      title, description, price: isFree ? 0 : parseInt(price) || 0, is_free: isFree,
      trade_type: tradeType, image_url: allUrls[0] ?? null, images: allUrls,
      place_name: placeName || null, location: placeAddr || null,
      latitude: placeLat, longitude: placeLng,
    }

    const { error } = isEdit
      ? await supabase.from('market_items').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing!.id)
      : await supabase.from('market_items').insert({ ...payload, user_id: user.id, nickname: user.nickname })

    setUploading(false)
    if (!error) onSubmitted()
    else alert('저장에 실패했어요. 다시 시도해주세요')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <Header
        left={<button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '14px', color: 'var(--ink-3)', cursor: 'pointer', padding: '8px' }}>취소</button>}
        title={isEdit ? '상품 수정' : '상품 등록'}
        right={<Button size="sm" onClick={handleSubmit} disabled={uploading}>{uploading ? '올리는 중' : isEdit ? '저장' : '등록'}</Button>}
      />
      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
        <Field label={keptUrls.length > 0 ? '사진 더 추가' : '사진'} required={keptUrls.length === 0} error={errors.image}>
          <MultiImageUploader images={images} onChange={(imgs) => { setImages(imgs); setErrors(p => ({ ...p, image: undefined })) }} max={Math.max(1, 5 - keptUrls.length)} error={!!errors.image} />
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
        <Field label="어디서 뽑았어요?" optional>
          {placeName ? (
            <div style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--coral)', background: 'var(--coral-soft)', position: 'relative' }}>
              <p style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px', paddingRight: '32px' }}>📍 {placeName}</p>
              {placeAddr && <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{placeAddr}</p>}
              <button onClick={() => { setPlaceName(''); setPlaceAddr(''); setPlaceLat(null); setPlaceLng(null) }} style={{ position: 'absolute', top: '12px', right: '12px', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', color: 'var(--ink-3)', fontSize: '13px', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowPlaceSearch(true)} className="pressable" style={{ width: '100%', padding: '14px 15px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', fontSize: '15px', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>🔍 뽑은 장소 검색하기</button>
          )}
        </Field>

        <Field label="설명" optional>
          <textarea placeholder="상품 상태, 거래 희망 장소 등을 적어주세요" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: '13px 15px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', fontSize: '14.5px', outline: 'none', minHeight: '110px', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />
        </Field>
      </main>

      {showPlaceSearch && (
        <PlaceSearchSheet user={user} onSelect={handlePlaceSelect} onClose={() => setShowPlaceSearch(false)} />
      )}
    </div>
  )
}
