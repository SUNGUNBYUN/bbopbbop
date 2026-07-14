'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User, Place } from '@/lib/types'
import { Header, BackButton, Button, Input, Field } from './ui'

declare global {
  interface Window { kakao: any }
}

type Props = {
  user: User
  onClose: () => void
  onRegistered: (place: Place) => void
}

type NearbyPlace = { id: string; name: string; lat: number; lng: number; distance: number }

export function PlaceRegister({ user, onClose, onRegistered }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [centerCoord, setCenterCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [nearby, setNearby] = useState<NearbyPlace[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'map' | 'info'>('map')

  useEffect(() => {
    if (window.kakao && window.kakao.maps && window.kakao.maps.Map) {
      setLoaded(true)
    } else if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => setLoaded(true))
    } else {
      const existing = document.querySelector('script[src*="dapi.kakao.com"]')
      if (existing) {
        existing.addEventListener('load', () => window.kakao.maps.load(() => setLoaded(true)))
      } else {
        const script = document.createElement('script')
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&libraries=services&autoload=false`
        script.onload = () => window.kakao.maps.load(() => setLoaded(true))
        document.head.appendChild(script)
      }
    }
  }, [])

  useEffect(() => {
    if (!loaded || !mapContainerRef.current || step !== 'map') return
    initMap()
  }, [loaded, step])

  function initMap() {
    if (!mapContainerRef.current) return
    if (mapContainerRef.current.offsetHeight === 0) {
      mapContainerRef.current.style.height = '100%'
      mapContainerRef.current.style.minHeight = '400px'
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => setupMap(pos.coords.latitude, pos.coords.longitude),
      () => setupMap(37.5665, 126.9780)
    )
  }

  function setupMap(lat: number, lng: number) {
    if (!mapContainerRef.current) return
    const center = new window.kakao.maps.LatLng(lat, lng)
    const map = new window.kakao.maps.Map(mapContainerRef.current, { center, level: 3 })
    mapRef.current = map
    setCenterCoord({ lat, lng })

    // 지도 이동 시 중앙 좌표 갱신
    window.kakao.maps.event.addListener(map, 'center_changed', () => {
      const c = map.getCenter()
      setCenterCoord({ lat: c.getLat(), lng: c.getLng() })
    })
  }

  // 주소 변환 + 근처 중복 체크
  async function confirmLocation() {
    if (!centerCoord) return
    // 좌표 → 주소 변환
    const geocoder = new window.kakao.maps.services.Geocoder()
    geocoder.coord2Address(centerCoord.lng, centerCoord.lat, (result: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const addr = result[0].road_address?.address_name || result[0].address?.address_name || ''
        setAddress(addr)
      }
    })

    // 근처 30m 이내 기존 업체 체크
    const { data } = await supabase.from('places').select('*')
    if (data) {
      const near = data
        .map(p => ({
          id: p.id, name: p.name, lat: p.latitude, lng: p.longitude,
          distance: getDistance(centerCoord.lat, centerCoord.lng, p.latitude, p.longitude),
        }))
        .filter(p => p.distance <= 30)
        .sort((a, b) => a.distance - b.distance)
      setNearby(near)
    }

    setStep('info')
  }

  async function handleSubmit() {
    if (name.trim().length < 2) { setError('업체명을 2글자 이상 입력해주세요'); return }
    if (!centerCoord) { setError('위치를 다시 지정해주세요'); return }
    setSubmitting(true)
    setError('')

    const { data, error: insertError } = await supabase.from('places').insert({
      name: name.trim(),
      address,
      latitude: centerCoord.lat,
      longitude: centerCoord.lng,
      registered_by: user.id,
      registered_nickname: user.nickname,
    }).select().single()

    setSubmitting(false)
    if (insertError) { setError('등록 중 오류가 발생했어요'); return }

    // Place 형태로 변환해서 전달
    onRegistered({
      place_name: name.trim(),
      address_name: address,
      road_address_name: address,
      x: String(centerCoord.lng),
      y: String(centerCoord.lat),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      <Header
        left={step === 'map' ? <BackButton onClick={onClose} /> : <BackButton onClick={() => setStep('map')} />}
        title={step === 'map' ? '업체 위치 지정' : '업체 정보 입력'}
      />

      {step === 'map' ? (
        <>
          <div style={{ padding: '12px 16px', background: 'var(--coral-soft)', textAlign: 'center', flexShrink: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--coral)', margin: 0 }}>
              지도를 움직여 업체 입구에 핀을 맞춰주세요
            </p>
          </div>

          <div style={{ flex: 1, position: 'relative', minHeight: '300px' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '300px' }} />

            {/* 중앙 고정 핀 */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -100%)', zIndex: 10, pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50% 50% 50% 4px',
                  transform: 'rotate(-45deg)', background: 'var(--coral)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(255,90,95,0.4)',
                }}>
                  <span style={{ transform: 'rotate(45deg)', fontSize: '18px' }}>🧸</span>
                </div>
              </div>
            </div>
            {/* 핀 그림자 */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -2px)', zIndex: 9, pointerEvents: 'none',
              width: '8px', height: '4px', borderRadius: '50%', background: 'rgba(0,0,0,0.2)',
            }} />
          </div>

          <div style={{ padding: '16px', flexShrink: 0 }}>
            <Button full size="lg" onClick={confirmLocation} disabled={!loaded}>
              이 위치로 지정하기
            </Button>
          </div>
        </>
      ) : (
        <main className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 근처 중복 경고 */}
          {nearby.length > 0 && (
            <div style={{ padding: '14px', borderRadius: 'var(--r-md)', background: 'var(--butter-soft)', border: '1.5px solid var(--butter)' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)', margin: '0 0 8px' }}>
                ⚠️ 근처에 이미 등록된 업체가 있어요
              </p>
              {nearby.map(p => (
                <button
                  key={p.id}
                  onClick={() => onRegistered({ place_name: p.name, address_name: address, road_address_name: address, x: String(p.lng), y: String(p.lat) })}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13.5px', color: 'var(--ink-2)', fontWeight: 600 }}
                >
                  📍 {p.name} <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>({Math.round(p.distance)}m) — 이 업체예요</span>
                </button>
              ))}
              <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '6px 0 0' }}>
                위 업체가 아니라면 아래에 새로 등록해주세요.
              </p>
            </div>
          )}

          <Field label="업체명" required error={error && name.trim().length < 2 ? error : undefined}>
            <Input
              placeholder="예) 홍대 뽑기왕 2호점"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
            />
          </Field>

          <Field label="주소">
            <Input
              placeholder="주소 (자동 입력됨)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <p style={{ fontSize: '12px', color: 'var(--ink-4)', margin: '8px 0 0' }}>
              지도 위치 기준으로 자동 입력됐어요. 필요하면 수정하세요.
            </p>
          </Field>

          {error && name.trim().length >= 2 && (
            <p style={{ fontSize: '13px', color: 'var(--danger)', margin: 0 }}>⚠ {error}</p>
          )}

          <Button full size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '등록 중...' : '✓ 업체 등록하고 제보 계속하기'}
          </Button>
        </main>
      )}
    </div>
  )
}

// 두 좌표 간 거리 (미터)
function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
