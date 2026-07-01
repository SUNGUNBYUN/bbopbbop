'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { User, Place } from '@/lib/types'
import { Header, BackButton, Button, Input, Field } from './ui'
import { MultiImageUploader, ImageSlot, uploadImages } from './MultiImageUploader'
import KakaoPlaceSearch from '@/app/KakaoMap'

type Props = {
  user: User
  onClose: () => void
  onSubmitted: () => void
}

type Errors = { image?: string; title?: string; location?: string }

export function PostForm({ user, onClose, onSubmitted }: Props) {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [locationDetail, setLocationDetail] = useState('')
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [locationPlaceName, setLocationPlaceName] = useState('')
  const [tags, setTags] = useState('')
  const [images, setImages] = useState<ImageSlot[]>([])
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [showMapSearch, setShowMapSearch] = useState(false)

  function handlePlaceSelect(place: Place) {
    setLocation(place.place_name)
    setLocationDetail(place.road_address_name || place.address_name)
    setLocationLat(parseFloat(place.y)); setLocationLng(parseFloat(place.x))
    setLocationPlaceName(place.place_name)
    setShowMapSearch(false); setErrors(p => ({ ...p, location: undefined }))
  }

  function validate() {
    const e: Errors = {}
    if (images.length === 0) e.image = '사진을 추가해주세요'
    if (!title.trim()) e.title = '뭐가 있는지 알려주세요'
    if (!location.trim()) e.location = '업체 위치를 입력해주세요'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setUploading(true)
    const urls = await uploadImages(supabase, images)
    const fullLocation = locationDetail ? `${location} (${locationDetail})` : location
    const { error } = await supabase.from('posts').insert({
      title, location: fullLocation, tags,
      image_url: urls[0] ?? null,   // 대표 이미지 (하위호환)
      images: urls,                 // 전체 이미지
      user_id: user.id, nickname: user.nickname,
      latitude: locationLat, longitude: locationLng, place_name: locationPlaceName,
    })
    setUploading(false)
    if (!error) onSubmitted()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      <Header
        left={<button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '14px', color: 'var(--ink-3)', cursor: 'pointer', padding: '8px' }}>취소</button>}
        title="제보하기"
        right={<Button size="sm" onClick={handleSubmit} disabled={uploading}>{uploading ? '올리는 중' : '올리기'}</Button>}
      />

      <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* 사진 (여러 장) */}
        <Field label="사진" required error={errors.image}>
          <MultiImageUploader
            images={images}
            onChange={(imgs) => { setImages(imgs); setErrors(p => ({ ...p, image: undefined })) }}
            max={5}
            error={!!errors.image}
          />
          <p style={{ fontSize: '12px', color: 'var(--ink-4)', margin: '8px 0 0' }}>첫 번째 사진이 대표로 보여요. 최대 5장.</p>
        </Field>

        {/* 뭐가 있어요 */}
        <Field label="뭐가 있어요?" required error={errors.title}>
          <Input
            placeholder="예) 피카츄 인형, 산리오 가챠"
            value={title}
            error={!!errors.title}
            onChange={(e) => { setTitle(e.target.value); setErrors(p => ({ ...p, title: undefined })) }}
          />
        </Field>

        {/* 업체 위치 */}
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

        {/* 태그 */}
        <Field label="태그" optional>
          <Input placeholder="#피카츄 #포켓몬" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </main>

      {showMapSearch && <KakaoPlaceSearch onSelect={handlePlaceSelect} onClose={() => setShowMapSearch(false)} />}
    </div>
  )
}
