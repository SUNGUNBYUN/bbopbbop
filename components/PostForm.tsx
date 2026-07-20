'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlace, awardProductReport, findNearbyPlaces, placeProducts, looksLikeClawMachine, NearbyPlace, PlaceProduct, POINTS } from '@/lib/points'
import { User, Place, Post } from '@/lib/types'
import { Header, BackButton, Button, Input, Field } from './ui'
import { MultiImageUploader, ImageSlot, uploadImages } from './MultiImageUploader'
import { PlaceSearchSheet } from './PlaceSearchSheet'

type Props = {
  user: User
  /** 값이 있으면 수정 모드 */
  editing?: Post | null
  onClose: () => void
  onSubmitted: (earnedPoints?: number, dupMessage?: string) => void
}

type Errors = { image?: string; title?: string; location?: string }

export function PostForm({ user, editing, onClose, onSubmitted }: Props) {
  const isEdit = !!editing
  const [title, setTitle] = useState(editing?.title ?? '')
  const [location, setLocation] = useState(editing?.place_name || editing?.location || '')
  const [locationDetail, setLocationDetail] = useState(editing?.location ?? '')
  const [locationLat, setLocationLat] = useState<number | null>(editing?.latitude ?? null)
  const [locationLng, setLocationLng] = useState<number | null>(editing?.longitude ?? null)
  const [locationPlaceName, setLocationPlaceName] = useState(editing?.place_name ?? '')
  const [tags, setTags] = useState(editing?.tags ?? '')
  // 수정 시 기존 사진(URL) / 새로 추가한 사진(File) 분리 관리
  const [keptUrls, setKeptUrls] = useState<string[]>(
    editing ? ((editing.images && editing.images.length > 0) ? editing.images : (editing.image_url ? [editing.image_url] : [])) : []
  )
  const [images, setImages] = useState<ImageSlot[]>([])
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [showMapSearch, setShowMapSearch] = useState(false)
  const [dupCandidates, setDupCandidates] = useState<NearbyPlace[]>([])
  const [existingPlaceId, setExistingPlaceId] = useState<string | null>(null)
  const [categoryWarn, setCategoryWarn] = useState(false)
  const [existingProducts, setExistingProducts] = useState<PlaceProduct[]>([])
  const [isDifferent, setIsDifferent] = useState(false)

  async function handlePlaceSelect(place: Place) {
    const lat = parseFloat(place.y)
    const lng = parseFloat(place.x)
    setLocation(place.place_name)
    setLocationDetail(place.road_address_name || place.address_name)
    setLocationLat(lat)
    setLocationLng(lng)
    setLocationPlaceName(place.place_name)
    setShowMapSearch(false)
    setErrors(p => ({ ...p, location: undefined }))
    setExistingPlaceId(null)
    setExistingProducts([])
    setCategoryWarn(!looksLikeClawMachine(place.category_name))
    // 중복 후보 조회
    const near = await findNearbyPlaces(lat, lng)
    setDupCandidates(near)
  }

  async function chooseExisting(id: string) {
    setExistingPlaceId(id)   // "이 가게 맞아요" → 이 가게에 상품 추가
    setIsDifferent(false)
    const prods = await placeProducts(id)
    setExistingProducts(prods)
  }
  function chooseNew() {
    setExistingPlaceId(null)
    setDupCandidates([])     // "아니요, 새 가게" → 후보 숨김
  }

  const totalPhotos = keptUrls.length + images.length

  function validate() {
    const e: Errors = {}
    if (totalPhotos === 0) e.image = '사진을 추가해주세요'
    if (!title.trim()) e.title = '뭐가 있는지 알려주세요'
    if (!location.trim()) e.location = '업체 위치를 입력해주세요'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // 올리기: 유저가 "다른 상품" 체크했으면 중복검사 건너뜀
  async function handleSubmit() {
    if (!validate()) return
    doSubmit(isDifferent)
  }

  async function doSubmit(force: boolean) {
    setUploading(true)

    let newUrls: string[] = []
    if (images.length > 0) {
      try {
        newUrls = await uploadImages(supabase, images)
      } catch (e: any) {
        setUploading(false)
        alert(e?.message ?? '사진 업로드에 실패했어요')
        return
      }
    }
    const urls = [...keptUrls, ...newUrls]
    const fullLocation = locationDetail ? `${location} (${locationDetail})` : location

    // ── 수정 모드: 내용만 갱신 (포인트/중복 판정 없음) ──
    if (isEdit && editing) {
      const { error: upErr } = await supabase.from('posts').update({
        title, location: fullLocation, tags,
        image_url: urls[0] ?? null,
        images: urls,
        latitude: locationLat, longitude: locationLng, place_name: locationPlaceName,
      }).eq('id', editing.id)
      setUploading(false)
      if (!upErr) onSubmitted()
      else alert('저장에 실패했어요. 다시 시도해주세요')
      return
    }

    let placeId: string | null = null
    let earned = 0
    if (locationLat != null && locationLng != null) {
      const pr = await getOrCreatePlace({
        placeName: locationPlaceName || location,
        address: fullLocation,
        lat: locationLat, lng: locationLng,
        existingPlaceId: existingPlaceId,
      })
      if (pr) { placeId = pr.place_id; earned += pr.place_reward ?? 0 }
    }

    const { data: post, error } = await supabase.from('posts').insert({
      title, location: fullLocation, tags,
      image_url: urls[0] ?? null,
      images: urls,
      user_id: user.id, nickname: user.nickname,
      latitude: locationLat, longitude: locationLng, place_name: locationPlaceName,
      place_id: placeId,
    }).select('id').single()

    let wasDup = false
    if (!error && post && placeId) {
      const rr = await awardProductReport(post.id, placeId, title, force)
      if (rr) { wasDup = rr.is_dup; earned += rr.post_reward ?? 0 }
    }

    setUploading(false)
    if (!error) {
      const dupMsg = wasDup ? '이미 제보된 상품이라 포인트는 없어요. 정보는 갱신했어요!' : undefined
      onSubmitted(earned, dupMsg)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--bg)' }}>
      <Header
        left={<button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '14px', color: 'var(--ink-3)', cursor: 'pointer', padding: '8px' }}>취소</button>}
        title={isEdit ? '제보 수정' : '제보하기'}
        right={<Button size="sm" onClick={handleSubmit} disabled={uploading}>{uploading ? '올리는 중' : isEdit ? '저장' : '올리기'}</Button>}
      />

      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!isEdit && (
          <div style={{ padding: '13px 15px', borderRadius: 'var(--r-md)', background: 'var(--butter-soft)', border: '1.5px solid var(--butter)' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)', margin: '0 0 6px' }}>🪙 포인트는 이렇게 들어와요</p>
            <p style={{ fontSize: '12.5px', color: 'var(--ink-2)', margin: 0, lineHeight: 1.65 }}>
              올리는 즉시 <b>{POINTS.report}P</b>, 다른 분이 “확인했어요”를 눌러주면 <b>+{POINTS.reportConfirmed}P</b>를 더 드려요.<br />
              지도에 없던 <b>새 가게</b>라면 <b>+{POINTS.placeCreate}P</b>, 그 가게가 확인되면 <b>+{POINTS.placeConfirmed}P</b>가 추가돼요.<br />
              <span style={{ color: 'var(--ink-4)' }}>이미 제보된 상품이면 포인트는 없어요.</span>
            </p>
          </div>
        )}

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
          <MultiImageUploader
            images={images}
            onChange={(imgs) => { setImages(imgs); setErrors(p => ({ ...p, image: undefined })) }}
            max={Math.max(1, 5 - keptUrls.length)}
            error={!!errors.image}
          />
          <p style={{ fontSize: '12px', color: 'var(--ink-4)', margin: '8px 0 0' }}>첫 번째 사진이 대표로 보여요. 최대 5장.</p>
        </Field>

        <Field label="뭐가 있어요?" required error={errors.title}>
          <Input
            placeholder="예) 피카츄 인형, 산리오 가챠"
            value={title}
            error={!!errors.title}
            onChange={(e) => { setTitle(e.target.value); setErrors(p => ({ ...p, title: undefined })) }}
          />
        </Field>

        <Field label="업체 위치" required error={errors.location}>
          {location ? (
            <div style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--coral)', background: 'var(--coral-soft)', position: 'relative' }}>
              <p style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px', paddingRight: '32px' }}>{location}</p>
              {locationDetail && <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{locationDetail}</p>}
              <button
                onClick={() => { setLocation(''); setLocationDetail(''); setLocationLat(null); setLocationLng(null); setLocationPlaceName('') }}
                style={{ position: 'absolute', top: '12px', right: '12px', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', color: 'var(--ink-3)', fontSize: '13px', border: 'none', cursor: 'pointer' }}
              >✕</button>
            </div>
          ) : (
            <button
              onClick={() => setShowMapSearch(true)}
              className="pressable"
              style={{
                width: '100%', padding: '14px 15px', borderRadius: 'var(--r-md)',
                border: `1.5px solid ${errors.location ? 'var(--danger)' : 'var(--line)'}`,
                fontSize: '15px', background: 'var(--surface)', cursor: 'pointer',
                textAlign: 'left', color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >🔍 업체명으로 검색하기</button>
          )}
        </Field>

        {/* 업종 경고: 오락/인형뽑기 카테고리가 아닐 때 */}
        {location && categoryWarn && (
          <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--danger)', background: 'rgba(255,90,95,0.08)' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--danger)', margin: '0 0 2px' }}>⚠️ 인형뽑기 가게가 맞나요?</p>
            <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>오락/게임 업종이 아닌 것 같아요. 인형뽑기가 없는 곳을 등록하면 다른 이용자 확인을 못 받아 포인트가 지급되지 않아요.</p>
          </div>
        )}

        {/* 중복 후보: "혹시 이 가게 아닌가요?" */}
        {dupCandidates.length > 0 && !existingPlaceId && (
          <div style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--coral)', background: 'var(--coral-soft)' }}>
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px' }}>🤔 이미 등록된 가게예요</p>
            <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 10px' }}>같은 가게면 선택하세요. 이 가게에 상품 제보를 추가해요(+20P). 다른 가게면 새로 등록하세요.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {dupCandidates.map(c => (
                <button key={c.id} onClick={() => chooseExisting(c.id)} className="pressable"
                  style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>📍 {c.place_name}</span>
                  <span style={{ fontSize: '11.5px', color: 'var(--ink-4)', marginLeft: 6 }}>{Math.round(c.distance_m)}m · 상품 {c.product_count}개</span>
                </button>
              ))}
            </div>
            <button onClick={chooseNew} style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--surface-2)', color: 'var(--ink-3)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              아니요, 다른(새) 가게예요
            </button>
          </div>
        )}
        {existingPlaceId && (
          <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--mint-soft, var(--coral-soft))', fontSize: '13px', color: 'var(--coral)', fontWeight: 600 }}>
            ✓ 이 가게에 상품을 추가해요. 다시 고르려면 위치를 다시 선택하세요.
          </div>
        )}
        {existingPlaceId && existingProducts.length > 0 && (
          <div style={{ padding: '14px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-2)', margin: '0 0 4px' }}>이 가게에 이미 제보된 상품 ({existingProducts.length})</p>
            <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: '0 0 10px' }}>사진을 보고 내가 올리려는 상품과 같은지 확인하세요. 같으면 포인트가 없어요.</p>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }} className="no-scrollbar">
              {existingProducts.map(p => (
                <div key={p.id} style={{ flexShrink: 0, width: '84px' }}>
                  <div style={{ width: '84px', height: '84px', borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line)' }}>
                    {p.image_url ? <img src={p.image_url} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '28px' }}>🧸</span>}
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--ink-3)', margin: '5px 0 0', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</p>
                </div>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isDifferent} onChange={(e) => setIsDifferent(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--coral)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-2)' }}>위 상품들과 <b style={{ color: 'var(--coral)' }}>다른 새 상품</b>이에요 (포인트 받기)</span>
            </label>
          </div>
        )}

        <Field label="태그" optional>
          <Input placeholder="#피카츄 #포켓몬" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </main>

      {showMapSearch && (
        <PlaceSearchSheet
          user={user}
          onSelect={handlePlaceSelect}
          onClose={() => setShowMapSearch(false)}
        />
      )}
    </div>
  )
}
