'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlace, awardProductReport, findNearbyPlaces, placeProducts, looksLikeClawMachine, NearbyPlace, PlaceProduct, POINTS } from '@/lib/points'
import { User, Place, Post } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
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
  // 기계 1대에 여러 인형이 들어있으므로 목록으로 관리
  const [products, setProducts] = useState<string[]>(
    editing?.products && editing.products.length > 0
      ? editing.products
      : (editing?.title ? [editing.title] : [])
  )
  const [productInput, setProductInput] = useState('')
  const [location, setLocation] = useState(editing?.place_name || editing?.location || '')
  const [locationDetail, setLocationDetail] = useState(editing?.location ?? '')
  const [locationLat, setLocationLat] = useState<number | null>(editing?.latitude ?? null)
  const [locationLng, setLocationLng] = useState<number | null>(editing?.longitude ?? null)
  const [locationPlaceName, setLocationPlaceName] = useState(editing?.place_name ?? '')
  const [locationKakaoId, setLocationKakaoId] = useState<string | null>(null)
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
  // 기존 제보 사진 확대 보기 (같은 상품인지 비교하려면 크게 봐야 함)
  const [zoomImage, setZoomImage] = useState<{ url: string; label: string } | null>(null)

  async function handlePlaceSelect(place: Place) {
    const lat = parseFloat(place.y)
    const lng = parseFloat(place.x)
    setLocation(place.place_name)
    setLocationDetail(place.road_address_name || place.address_name)
    setLocationLat(lat)
    setLocationLng(lng)
    setLocationPlaceName(place.place_name)
    setLocationKakaoId(place.kakao_id ?? null)
    setShowMapSearch(false)
    setErrors(p => ({ ...p, location: undefined }))
    setCategoryWarn(!looksLikeClawMachine(place.category_name))

    // 이미 뽑뽑에 등록된 가게를 고른 경우 → 어느 가게인지 확정이므로
    // 중복 확인을 다시 물어보지 않고 바로 연결합니다.
    if (place.place_id) {
      setExistingPlaceId(place.place_id)
      setDupCandidates([])
      const prods = await placeProducts(place.place_id)
      setExistingProducts(prods)
      return
    }

    setExistingPlaceId(null)
    setExistingProducts([])

    // 카카오에서 고른 경우 → 이미 등록된 같은 가게가 있는지 확인
    const near = await findNearbyPlaces(lat, lng, place.kakao_id, place.place_name)

    // 이름이 완전히 같고 아주 가까운 후보가 딱 하나면 물어보지 않고 바로 연결.
    // (같은 가게가 명백한데 확인을 요구하면 불필요한 단계가 됩니다)
    const norm = (v: string) => v.replace(/\s/g, '').toLowerCase()
    const exact = near.filter(c => norm(c.place_name) === norm(place.place_name) && c.distance_m <= 100)

    if (exact.length === 1) {
      setExistingPlaceId(exact[0].id)
      setDupCandidates([])
      const prods = await placeProducts(exact[0].id)
      setExistingProducts(prods)
      return
    }

    // 애매한 경우에만 사용자에게 확인
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

  /** 인형 목록 → 대표 제목 ("짱구 외 4종") */
  const title = products.length === 0
    ? ''
    : products.length === 1
      ? products[0]
      : `${products[0]} 외 ${products.length - 1}종`

  function addProduct(raw?: string) {
    const v = (raw ?? productInput).trim()
    if (!v) return
    // 상품명 안에 쉼표가 들어가는 경우가 있어(예: "목걸이 (핑크, 화이트)")
    // 자동으로 나누지 않고 입력한 그대로 하나로 추가합니다.
    const dup = products.some(x => x.replace(/\s/g, '') === v.replace(/\s/g, ''))
    if (dup || products.length >= 20) { setProductInput(''); return }
    setProducts([...products, v])
    setProductInput('')
    setErrors(e => ({ ...e, title: undefined }))
  }

  function removeProduct(i: number) {
    setProducts(products.filter((_, idx) => idx !== i))
  }

  function validate() {
    const e: Errors = {}
    if (totalPhotos === 0) e.image = '사진을 추가해주세요'
    if (products.length === 0) e.title = '어떤 인형이 있는지 하나 이상 적어주세요'
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
        title, products, location: fullLocation, tags,
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
        // 주소만 저장 (가게명이 앞에 붙으면 같은 가게를 다르게 인식함)
        address: locationDetail || location,
        lat: locationLat, lng: locationLng,
        kakaoId: locationKakaoId,
        existingPlaceId: existingPlaceId,
      })
      if (pr) { placeId = pr.place_id; earned += pr.place_reward ?? 0 }
    }

    const { data: post, error } = await supabase.from('posts').insert({
      title, products, location: fullLocation, tags,
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

        <Field label="이 기계에 뭐가 있어요?" required error={errors.title}>
          {/* 기계 한 대에 여러 종류가 섞여 있는 경우가 많아 목록으로 받습니다 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input
              placeholder="예) 잔망루피, 산리오 쿠로미, 짱구"
              value={productInput}
              error={!!errors.title}
              onChange={(e) => setProductInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addProduct() }
              }}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => addProduct()}
              disabled={!productInput.trim()}
              className="pressable"
              style={{
                flexShrink: 0, padding: '0 18px', borderRadius: 'var(--r-md)',
                border: 'none', background: productInput.trim() ? 'var(--coral)' : 'var(--surface-3)',
                color: productInput.trim() ? '#fff' : 'var(--ink-4)',
                fontSize: '14px', fontWeight: 700, cursor: productInput.trim() ? 'pointer' : 'default',
              }}
            >추가</button>
          </div>

          {products.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '10px' }}>
              {products.map((p, i) => (
                <span
                  key={p + i}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '7px 10px 7px 12px', borderRadius: 'var(--r-full)',
                    background: 'var(--coral-soft)', color: 'var(--coral)',
                    fontSize: '13px', fontWeight: 700,
                  }}
                >
                  {p}
                  <button
                    type="button"
                    onClick={() => removeProduct(i)}
                    style={{ background: 'none', border: 'none', color: 'var(--coral)', fontSize: '13px', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    aria-label={`${p} 빼기`}
                  >✕</button>
                </span>
              ))}
            </div>
          )}

          <p style={{ fontSize: '12px', color: 'var(--ink-4)', margin: '9px 0 0', lineHeight: 1.55 }}>
            한 기계에 여러 종류가 있으면 <b>하나씩</b> 추가해주세요. 입력 후 Enter 또는 추가 버튼.<br />
            {products.length > 0 && <span style={{ color: 'var(--ink-3)' }}>제목은 <b>{title}</b> 으로 올라가요.</span>}
          </p>
        </Field>

        <Field label="업체 위치" required error={errors.location}>
          {location ? (
            <div style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--coral)', background: 'var(--coral-soft)', position: 'relative' }}>
              <p style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px', paddingRight: '32px' }}>{location}</p>
              {locationDetail && <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{locationDetail}</p>}
              <button
                onClick={() => { setLocation(''); setLocationDetail(''); setLocationLat(null); setLocationLng(null); setLocationPlaceName(''); setLocationKakaoId(null) }}
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
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px' }}>🤔 혹시 이 가게인가요?</p>
            <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 10px' }}>비슷한 이름의 가게가 근처에 있어요. 같은 곳이면 선택해주세요. <b>다른 가게라면 아래에서 새로 등록</b>하시면 돼요.</p>
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
            ✓ <b>이미 등록된 가게</b>예요. 여기에 제보를 추가해요. 다른 가게면 위치를 다시 선택하세요.
          </div>
        )}
        {existingPlaceId && existingProducts.length > 0 && (
          <div style={{ padding: '14px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-2)', margin: '0 0 4px' }}>이 가게에 이미 제보된 상품 ({existingProducts.length})</p>
            <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: '0 0 10px' }}>사진을 눌러 크게 보고, 내가 올리려는 것과 같은지 확인하세요. 같으면 포인트가 없어요.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {existingProducts.map(p => {
                const names = p.products && p.products.length > 0 ? p.products : [p.title]
                return (
                  <div key={p.id} style={{ display: 'flex', gap: '12px', padding: '10px', borderRadius: 'var(--r-md)', background: 'var(--surface)', border: '1px solid var(--line)' }}>
                    <button
                      type="button"
                      onClick={() => p.image_url && setZoomImage({ url: p.image_url, label: names.join(', ') })}
                      style={{
                        flexShrink: 0, width: '110px', height: '110px', padding: 0,
                        borderRadius: 'var(--r-sm)', overflow: 'hidden', background: 'var(--surface-2)',
                        border: 'none', cursor: p.image_url ? 'zoom-in' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                      }}
                    >
                      {p.image_url
                        ? <>
                            <img src={p.image_url} alt={names.join(', ')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span style={{ position: 'absolute', right: '4px', bottom: '4px', background: 'rgba(26,21,35,0.6)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-full)' }}>🔍 크게</span>
                          </>
                        : <span style={{ fontSize: '34px' }}>🧸</span>}
                    </button>

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                        {names.map((n, i) => (
                          <span key={n + i} style={{
                            padding: '4px 9px', borderRadius: 'var(--r-full)',
                            background: 'var(--surface-2)', color: 'var(--ink-2)',
                            fontSize: '12px', fontWeight: 700,
                          }}>🧸 {n}</span>
                        ))}
                      </div>
                      <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: 0 }}>{timeAgo(p.created_at)}</p>
                    </div>
                  </div>
                )
              })}
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

      {/* 사진 확대 보기 */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px', cursor: 'zoom-out',
          }}
        >
          <img
            src={zoomImage.url}
            alt={zoomImage.label}
            style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: 'var(--r-md)' }}
          />
          <p style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: '18px 0 0', textAlign: 'center', lineHeight: 1.5 }}>
            🧸 {zoomImage.label}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12.5px', margin: '10px 0 0' }}>
            아무 곳이나 눌러 닫기
          </p>
        </div>
      )}

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
