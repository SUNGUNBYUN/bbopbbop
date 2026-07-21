'use client'
import { useState, useEffect } from 'react'
import { User, Post, Place } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import {
  Bounty, BountyAnswer, BountyStatus, BOUNTY_STATUS_LABEL,
  MIN_REWARD, MAX_REWARD, DEFAULT_REWARD, DEFAULT_DAYS,
  listBounties, getAnswers, createBounty, answerBounty,
  resolveBounty, cancelBounty, expireBounties, daysLeft,
} from '@/lib/bounty'
import { Header, BackButton, Button, Input, Field, EmptyState, Badge, Avatar, Spinner } from './ui'
import { PlaceSearchSheet } from './PlaceSearchSheet'
import { PlaceMapView } from './PlaceMapView'

type Props = {
  user: User | null
  posts: Post[]
  balance: number
  onClose: () => void
  onRequireAuth: () => void
  onChanged: () => void
  onToast: (msg: string, emoji?: string) => void
}

/** 제보 현상금 게시판 */
export function BountyBoard({ user, posts, balance, onClose, onRequireAuth, onChanged, onToast }: Props) {
  const [tab, setTab] = useState<'open' | 'mine'>('open')
  const [bounties, setBounties] = useState<Bounty[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Bounty | null>(null)

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    await expireBounties()          // 기간 지난 건 자동 환불
    const all = await listBounties('all')
    setBounties(all)
    setLoading(false)
  }

  const shown = tab === 'open'
    ? bounties.filter(b => b.status === 'open')
    : bounties.filter(b => user && (b.user_id === user.id))

  if (selected) {
    return (
      <BountyDetail
        bounty={selected}
        user={user}
        posts={posts}
        onBack={() => { setSelected(null); load(); onChanged() }}
        onRequireAuth={onRequireAuth}
        onToast={onToast}
      />
    )
  }

  if (showForm && user) {
    return (
      <BountyForm
        user={user}
        balance={balance}
        onClose={() => setShowForm(false)}
        onCreated={() => { setShowForm(false); load(); onChanged(); onToast('현상금을 걸었어요!', '🎯') }}
        onToast={onToast}
      />
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', maxWidth: 'var(--app-max)', margin: '0 auto', background: 'var(--bg)', zIndex: 190, display: 'flex', flexDirection: 'column' }}>
      <Header left={<BackButton onClick={onClose} />} title="🎯 제보 현상금" />

      {/* 안내 */}
      <div style={{ padding: '12px 16px', background: 'var(--coral-soft)', flexShrink: 0 }}>
        <p style={{ fontSize: '12.5px', color: 'var(--coral)', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
          찾는 인형이 있나요? 포인트를 걸고 물어보세요.<br />
          좋은 제보를 채택하면 그 분에게 포인트가 전해져요.
        </p>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '6px', padding: '12px 16px', flexShrink: 0 }}>
        {([['open', '찾는 중'], ['mine', '내 현상금']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              flex: 1, padding: '10px', borderRadius: 'var(--r-md)',
              border: tab === k ? '1.5px solid var(--coral)' : '1.5px solid var(--line)',
              background: tab === k ? 'var(--coral-soft)' : 'var(--surface)',
              color: tab === k ? 'var(--coral)' : 'var(--ink-3)',
              fontSize: '13.5px', fontWeight: 700, cursor: 'pointer',
            }}
          >{label}</button>
        ))}
      </div>

      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 90px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <Spinner label="불러오는 중" />
        ) : shown.length === 0 ? (
          tab === 'open'
            ? <EmptyState emoji="🎯" title="아직 걸린 현상금이 없어요" desc="찾는 인형이 있다면 포인트를 걸고 물어보세요!" action={<Button onClick={() => { if (!user) { onRequireAuth(); return }; setShowForm(true) }}>+ 현상금 걸기</Button>} />
            : <EmptyState emoji="📭" title="내가 건 현상금이 없어요" desc="찾는 게 있으면 현상금을 걸어보세요" />
        ) : (
          shown.map(b => {
            const st = BOUNTY_STATUS_LABEL[b.status]
            const left = daysLeft(b.expires_at)
            return (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className="pressable"
                style={{ textAlign: 'left', width: '100%', padding: '15px', borderRadius: 'var(--r-md)', background: 'var(--surface)', border: 'none', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Badge color={st.color} bg={st.bg}>{st.text}</Badge>
                      {b.status === 'open' && (
                        <span style={{ fontSize: '11.5px', color: 'var(--ink-4)', fontWeight: 600 }}>
                          {left > 0 ? `${left}일 남음` : '오늘 마감'}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px', lineHeight: 1.35 }}>{b.title}</p>
                    {b.place_name && (
                      <p style={{ fontSize: '12.5px', color: 'var(--coral)', fontWeight: 600, margin: '0 0 4px' }}>📍 {b.place_name}</p>
                    )}
                    <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: 0 }}>
                      {b.nickname ?? '익명'} · {timeAgo(b.created_at)} · 답변 {b.answer_count}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'center', padding: '8px 12px', borderRadius: 'var(--r-md)', background: 'var(--butter-soft)' }}>
                    <p style={{ fontSize: '17px', fontWeight: 800, color: 'var(--warning)', margin: 0 }}>{b.reward}</p>
                    <p style={{ fontSize: '10.5px', color: 'var(--warning)', margin: 0, fontWeight: 700 }}>P</p>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </main>

      <button
        onClick={() => { if (!user) { onRequireAuth(); return }; setShowForm(true) }}
        className="pressable"
        style={{ position: 'absolute', bottom: 'calc(16px + env(safe-area-inset-bottom))', right: '18px', padding: '15px 22px', borderRadius: 'var(--r-full)', background: 'var(--coral)', color: '#fff', fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-coral)', zIndex: 40 }}
      >+ 현상금 걸기</button>
    </div>
  )
}


/* ---------------- 현상금 등록 ---------------- */

function BountyForm({ user, balance, onClose, onCreated, onToast }: {
  user: User; balance: number; onClose: () => void; onCreated: () => void; onToast: (m: string, e?: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reward, setReward] = useState(String(DEFAULT_REWARD))
  const [days, setDays] = useState(DEFAULT_DAYS)
  const [placeName, setPlaceName] = useState('')
  const [placeAddr, setPlaceAddr] = useState('')
  const [placeLat, setPlaceLat] = useState<number | null>(null)
  const [placeLng, setPlaceLng] = useState<number | null>(null)
  // 뽑뽑에 등록된 가게를 고른 경우 그 가게와 직접 연결 (이름만으로 묶지 않기 위해)
  const [placeId, setPlaceId] = useState<string | null>(null)
  const [showPlaceSearch, setShowPlaceSearch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const rewardNum = parseInt(reward) || 0
  const canSubmit = title.trim().length > 0 && rewardNum >= MIN_REWARD && rewardNum <= balance

  function handlePlaceSelect(place: Place) {
    setPlaceName(place.place_name)
    setPlaceAddr(place.road_address_name || place.address_name)
    setPlaceLat(parseFloat(place.y))
    setPlaceLng(parseFloat(place.x))
    setPlaceId(place.place_id ?? null)
    setShowPlaceSearch(false)
  }

  async function handleSubmit() {
    setError('')
    if (rewardNum < MIN_REWARD) { setError(`현상금은 최소 ${MIN_REWARD}P부터예요`); return }
    if (rewardNum > MAX_REWARD) { setError(`현상금은 최대 ${MAX_REWARD}P까지예요`); return }
    if (rewardNum > balance) { setError('포인트가 부족해요'); return }

    setSaving(true)
    try {
      await createBounty({
        title: title.trim(),
        description: description.trim() || undefined,
        placeName: placeName || null,
        location: placeAddr || null,
        lat: placeLat, lng: placeLng,
        placeId,
        reward: rewardNum,
        days,
      })
      onCreated()
    } catch (e: any) {
      setError(e?.message ?? '등록에 실패했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', maxWidth: 'var(--app-max)', margin: '0 auto', background: 'var(--bg)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <Header
        left={<button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '14px', color: 'var(--ink-3)', cursor: 'pointer', padding: '8px' }}>취소</button>}
        title="현상금 걸기"
        right={<Button size="sm" onClick={handleSubmit} disabled={saving || !canSubmit}>{saving ? '등록 중' : '등록'}</Button>}
      />

      <main className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div style={{ padding: '13px 15px', borderRadius: 'var(--r-md)', background: 'var(--butter-soft)' }}>
          <p style={{ fontSize: '13px', color: 'var(--warning)', fontWeight: 700, margin: 0 }}>
            내 포인트 {balance.toLocaleString()}P
          </p>
          <p style={{ fontSize: '11.5px', color: 'var(--ink-3)', margin: '4px 0 0', lineHeight: 1.5 }}>
            등록하면 포인트가 먼저 빠져나가 묶여요. 채택하면 답변자에게 전해지고, 답변이 없어 취소·만료되면 돌려받아요.
          </p>
        </div>

        <Field label="무엇을 찾고 있나요?" required>
          <Input
            placeholder="예) 강남역 근처 산리오 인형 있는 곳"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError('') }}
          />
        </Field>

        <Field label="자세한 설명" optional>
          <textarea
            placeholder="원하는 인형 종류, 조건 등을 적어주세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', padding: '13px 15px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', fontSize: '14.5px', outline: 'none', minHeight: '90px', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }}
          />
        </Field>

        <Field label="찾는 지역" optional>
          {placeName ? (
            <div style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--coral)', background: 'var(--coral-soft)', position: 'relative' }}>
              <p style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px', paddingRight: '32px' }}>📍 {placeName}</p>
              {placeAddr && <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{placeAddr}</p>}
              <button onClick={() => { setPlaceName(''); setPlaceAddr(''); setPlaceLat(null); setPlaceLng(null); setPlaceId(null) }} style={{ position: 'absolute', top: '12px', right: '12px', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', color: 'var(--ink-3)', fontSize: '13px', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowPlaceSearch(true)} className="pressable" style={{ width: '100%', padding: '14px 15px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', fontSize: '15px', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>🔍 지역·업체 검색 (선택)</button>
          )}
        </Field>

        <Field label="걸 포인트" required>
          <Input
            type="number"
            placeholder={`${MIN_REWARD} ~ ${MAX_REWARD}`}
            value={reward}
            error={rewardNum > balance}
            onChange={(e) => { setReward(e.target.value); setError('') }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            {[30, 50, 100, 300].map(v => (
              <button
                key={v}
                onClick={() => { setReward(String(v)); setError('') }}
                style={{ flex: 1, padding: '9px 4px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--line)', background: reward === String(v) ? 'var(--coral-soft)' : 'var(--surface)', color: reward === String(v) ? 'var(--coral)' : 'var(--ink-3)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
              >{v}P</button>
            ))}
          </div>
        </Field>

        <Field label="기간">
          <div style={{ display: 'flex', gap: '6px' }}>
            {[3, 7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{ flex: 1, padding: '11px 4px', borderRadius: 'var(--r-md)', border: days === d ? '1.5px solid var(--coral)' : '1.5px solid var(--line)', background: days === d ? 'var(--coral-soft)' : 'var(--surface)', color: days === d ? 'var(--coral)' : 'var(--ink-3)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >{d}일</button>
            ))}
          </div>
        </Field>

        {error && <p style={{ fontSize: '13px', color: 'var(--danger)', margin: 0, fontWeight: 600 }}>⚠ {error}</p>}
      </main>

      {showPlaceSearch && (
        <PlaceSearchSheet user={user} onSelect={handlePlaceSelect} onClose={() => setShowPlaceSearch(false)} />
      )}
    </div>
  )
}


/* ---------------- 현상금 상세 ---------------- */

function BountyDetail({ bounty, user, posts, onBack, onRequireAuth, onToast }: {
  bounty: Bounty; user: User | null; posts: Post[]; onBack: () => void; onRequireAuth: () => void; onToast: (m: string, e?: string) => void
}) {
  const [answers, setAnswers] = useState<BountyAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [linkedPost, setLinkedPost] = useState<string | null>(null)
  const [showPostPicker, setShowPostPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [status, setStatus] = useState<BountyStatus>(bounty.status)
  const [winnerId, setWinnerId] = useState<string | null>(bounty.winner_answer_id)

  const isMine = user?.id === bounty.user_id
  const st = BOUNTY_STATUS_LABEL[status]
  const left = daysLeft(bounty.expires_at)
  const myAnswer = answers.find(a => a.user_id === user?.id)

  useEffect(() => { load() }, [bounty.id])

  async function load() {
    setLoading(true)
    setAnswers(await getAnswers(bounty.id))
    setLoading(false)
  }

  async function handleAnswer() {
    if (!user) { onRequireAuth(); return }
    if (!linkedPost && !comment.trim()) { onToast('제보를 연결하거나 내용을 적어주세요', '⚠️'); return }
    setBusy(true)
    try {
      await answerBounty(bounty.id, linkedPost, comment.trim() || undefined)
      setComment(''); setLinkedPost(null)
      await load()
      onToast('답변을 남겼어요!', '✅')
    } catch (e: any) {
      onToast(e?.message ?? '답변에 실패했어요', '⚠️')
    } finally { setBusy(false) }
  }

  async function handleResolve(answerId: string, nickname: string | null) {
    if (!confirm(`${nickname ?? '이 분'}을 채택하고 ${bounty.reward}P를 드릴까요?\n채택하면 되돌릴 수 없어요.`)) return
    setBusy(true)
    try {
      await resolveBounty(bounty.id, answerId)
      setStatus('resolved'); setWinnerId(answerId)
      onToast(`채택 완료! ${bounty.reward}P를 전달했어요`, '🎉')
    } catch (e: any) {
      onToast(e?.message ?? '채택에 실패했어요', '⚠️')
    } finally { setBusy(false) }
  }

  async function handleCancel() {
    if (!confirm('현상금을 취소하고 포인트를 돌려받을까요?')) return
    setBusy(true)
    try {
      const refund = await cancelBounty(bounty.id)
      setStatus('canceled')
      onToast(`취소했어요. ${refund}P를 돌려받았어요`, '↩️')
    } catch (e: any) {
      onToast(e?.message ?? '취소에 실패했어요', '⚠️')
    } finally { setBusy(false) }
  }

  const myPosts = posts.filter(p => p.user_id === user?.id)

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', maxWidth: 'var(--app-max)', margin: '0 auto', background: 'var(--bg)', zIndex: 195, display: 'flex', flexDirection: 'column' }}>
      <Header left={<BackButton onClick={onBack} />} title="현상금 상세" />

      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* 헤더 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Badge color={st.color} bg={st.bg}>{st.text}</Badge>
            {status === 'open' && (
              <span style={{ fontSize: '12px', color: 'var(--ink-4)', fontWeight: 600 }}>
                {left > 0 ? `${left}일 남음` : '오늘 마감'}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.35 }}>{bounty.title}</h1>
          <div style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 'var(--r-full)', background: 'var(--butter-soft)' }}>
            <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--warning)' }}>🎯 {bounty.reward}P</span>
          </div>
        </div>

        {bounty.description && (
          <p style={{ fontSize: '14.5px', color: 'var(--ink-2)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{bounty.description}</p>
        )}

        {bounty.place_name && (
          bounty.latitude != null && bounty.longitude != null ? (
            <button onClick={() => setShowMap(true)} className="pressable" style={{ background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ padding: '13px 14px', borderRadius: 'var(--r-md)', background: 'var(--coral-soft)', border: '1.5px solid var(--coral)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px' }}>📍 {bounty.place_name}</p>
                  {bounty.location && <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{bounty.location}</p>}
                </div>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--coral)', flexShrink: 0 }}>지도 ›</span>
              </div>
            </button>
          ) : (
            <div style={{ padding: '13px 14px', borderRadius: 'var(--r-md)', background: 'var(--coral-soft)', border: '1.5px solid var(--coral)' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>📍 {bounty.place_name}</p>
            </div>
          )
        )}

        {/* 요청자 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'var(--surface)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-sm)' }}>
          <Avatar name={bounty.nickname} />
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px' }}>{bounty.nickname ?? '익명'}</p>
            <p style={{ fontSize: '12px', color: 'var(--ink-4)', margin: 0 }}>{timeAgo(bounty.created_at)}</p>
          </div>
        </div>

        {/* 내가 건 현상금 → 취소 */}
        {isMine && status === 'open' && answers.length === 0 && (
          <Button full variant="outline" onClick={handleCancel} disabled={busy}>현상금 취소하고 환불받기</Button>
        )}

        {/* 답변 목록 */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px' }}>
            답변 {answers.length > 0 && <span style={{ color: 'var(--coral)' }}>{answers.length}</span>}
          </h3>

          {loading ? (
            <Spinner />
          ) : answers.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--ink-4)', textAlign: 'center', padding: '24px 0' }}>
              아직 답변이 없어요{status === 'open' ? '. 알고 계시면 알려주세요!' : ''}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {answers.map(a => {
                const isWinner = winnerId === a.id
                const linked = posts.find(p => p.id === a.post_id)
                return (
                  <div
                    key={a.id}
                    style={{
                      padding: '14px', borderRadius: 'var(--r-md)',
                      background: isWinner ? 'var(--mint-soft)' : 'var(--surface)',
                      border: isWinner ? '1.5px solid var(--success)' : '1px solid var(--line)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Avatar name={a.nickname} size={28} color="var(--ink-3)" />
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink-2)' }}>{a.nickname ?? '익명'}</span>
                      <span style={{ fontSize: '11.5px', color: 'var(--ink-4)' }}>{timeAgo(a.created_at)}</span>
                      {isWinner && <Badge color="var(--success)" bg="#fff">채택됨 🎉</Badge>}
                    </div>

                    {a.comment && (
                      <p style={{ fontSize: '14px', color: 'var(--ink)', margin: '0 0 8px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{a.comment}</p>
                    )}

                    {linked && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)' }}>
                        {linked.image_url && (
                          <img src={linked.image_url} alt={linked.title} style={{ width: '46px', height: '46px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🧸 {linked.title}</p>
                          {linked.location && <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{linked.location}</p>}
                        </div>
                      </div>
                    )}

                    {isMine && status === 'open' && (
                      <Button full size="sm" onClick={() => handleResolve(a.id, a.nickname)} disabled={busy} style={{ marginTop: '10px' }}>
                        이 답변 채택하고 {bounty.reward}P 주기
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 답변 작성 */}
        {!isMine && status === 'open' && (
          myAnswer ? (
            <div style={{ padding: '13px 15px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--ink-3)', margin: 0, fontWeight: 600 }}>이미 답변을 남겼어요. 채택을 기다려주세요!</p>
            </div>
          ) : (
            <div style={{ padding: '15px', borderRadius: 'var(--r-md)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>알고 계신가요? 알려주세요</p>

              {linkedPost ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: 'var(--r-sm)', background: 'var(--coral-soft)' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--coral)', flex: 1 }}>
                    🧸 {posts.find(p => p.id === linkedPost)?.title ?? '제보 연결됨'}
                  </span>
                  <button onClick={() => setLinkedPost(null)} style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', color: 'var(--ink-3)' }}>✕</button>
                </div>
              ) : (
                myPosts.length > 0 && (
                  <button onClick={() => setShowPostPicker(!showPostPicker)} className="pressable" style={{ width: '100%', padding: '12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-3)', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                    🔗 내 제보 연결하기 (선택)
                  </button>
                )
              )}

              {showPostPicker && !linkedPost && (
                <div className="no-scrollbar" style={{ maxHeight: '190px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {myPosts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setLinkedPost(p.id); setShowPostPicker(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}
                    >
                      {p.image_url && <img src={p.image_url} alt={p.title} style={{ width: '38px', height: '38px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</p>
                        {p.location && <p style={{ fontSize: '11px', color: 'var(--ink-4)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.location}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                placeholder="어디에 있는지 알려주세요"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{ width: '100%', padding: '13px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', fontSize: '14px', outline: 'none', minHeight: '80px', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }}
              />

              <Button full onClick={handleAnswer} disabled={busy || (!linkedPost && !comment.trim())}>
                {busy ? '등록 중…' : '답변 남기기'}
              </Button>
            </div>
          )
        )}
      </main>

      {showMap && bounty.place_name && bounty.latitude != null && bounty.longitude != null && (
        <PlaceMapView name={bounty.place_name} address={bounty.location} lat={bounty.latitude} lng={bounty.longitude} onClose={() => setShowMap(false)} />
      )}
    </div>
  )
}
