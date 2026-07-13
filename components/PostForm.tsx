'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User, Place } from '@/lib/types'
import { Header, BackButton, Button, Input, Field } from './ui'
import { MultiImageUploader, ImageSlot, uploadImages } from './MultiImageUploader'

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
    setLocationLat(parseFloat(place.y))
    setLocationLng(parseFloat(place.x))
    setLocationPlaceName(place.place_name)
    setShowMapSearch(false)
    setErrors(p => ({ ...p, location: undefined }))
  }

  function validate() {
    const e: Errors = {}
    if (images.length === 0) e.image = '사진을 추가해주세요'
    if (!title.trim()) e.title = '뭐가 있는지 알려주세요'
    if (!location.trim()) e.location = '업체 위치를 입력해주세요'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setUploading(true)
    const urls = await uploadImages(supabase, images)
    const fullLocation = locationDetail ? `${location} (${locationDetail})` : location
    const { error } = await supabase.from('posts').insert({
      title, location: fullLocation, tags,
      image_url: urls[0] ?? null,
      images: urls,
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
        <Field label="사진" required error={errors.image}>
          <MultiImageUploader
            images={images}
            onChange={(imgs) => { setImages(imgs); setErrors(p => ({ ...p, image: undefined })) }}
            max={5}
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

        <Field label="태그" optional>
          <Input placeholder="#피카츄 #포켓몬" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
      </main>

      {showMapSearch && <PlaceSearchSheet onSelect={handlePlaceSelect} onClose={() => setShowMapSearch(false)} />}
    </div>
  )
}

function PlaceSearchSheet({ onSelect, onClose }: { onSelect: (place: Place) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])

  function search() {
    if (!query.trim()) return
    const ps = new (window as any).kakao.maps.services.Places()
    ps.keywordSearch(query, (data: any[], status: string) => {
      if (status === (window as any).kakao.maps.services.Status.OK) {
        setResults(data.map((p: any) => ({
          place_name: p.place_name,
          address_name: p.address_name,
          road_address_name: p.road_address_name,
          x: p.x,
          y: p.y,
        })))
      } else {
        setResults([])
      }
    })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,35,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 'var(--app-max)', margin: '0 auto', background: 'var(--surface)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0', padding: '20px', maxHeight: '70dvh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>업체 검색</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <input
            placeholder="업체명 검색 (예: 홍대 뽑기왕)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            style={{ flex: 1, padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={search} style={{ padding: '12px 18px', borderRadius: 'var(--r-md)', background: 'var(--coral)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>검색</button>
        </div>
        <div className="no-scrollbar" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {results.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px', padding: '24px 0' }}>업체명으로 검색해보세요</p>
          )}
          {results.map((place, i) => (
            <button key={i} onClick={() => onSelect(place)} style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <p style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px' }}>{place.place_name}</p>
              <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{place.road_address_name || place.address_name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}