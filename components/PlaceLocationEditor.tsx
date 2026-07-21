'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Header, BackButton, Button } from './ui'

declare global {
  interface Window { kakao: any }
}

/**
 * 가게 위치(좌표)를 지도에서 다시 찍어 고치는 화면.
 * 카카오에 같은 가게가 여러 좌표로 등록돼 있어 잘못된 위치가 남았을 때 사용.
 */
export function PlaceLocationEditor({ placeId, placeName, address, lat, lng, onClose, onSaved, onToast }: {
  placeId: string
  placeName: string
  address?: string | null
  lat: number
  lng: number
  onClose: () => void
  onSaved: () => void
  onToast?: (msg: string, emoji?: string) => void
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat, lng })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (window.kakao?.maps?.Map) setLoaded(true)
    else if (window.kakao?.maps) window.kakao.maps.load(() => setLoaded(true))
    else {
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
    if (!loaded || !mapContainerRef.current) return
    const start = new window.kakao.maps.LatLng(lat, lng)
    const map = new window.kakao.maps.Map(mapContainerRef.current, { center: start, level: 3 })
    window.kakao.maps.event.addListener(map, 'center_changed', () => {
      const c = map.getCenter()
      setCenter({ lat: c.getLat(), lng: c.getLng() })
    })
  }, [loaded, lat, lng])

  async function handleSave() {
    setSaving(true)
    try {
      // 좌표에 맞는 주소도 새로 가져와서 같이 저장
      let newAddr: string | null = null
      try {
        const geocoder = new window.kakao.maps.services.Geocoder()
        newAddr = await new Promise<string | null>((resolve) => {
          geocoder.coord2Address(center.lng, center.lat, (result: any[], status: string) => {
            if (status === window.kakao.maps.services.Status.OK && result[0]) {
              resolve(result[0].road_address?.address_name || result[0].address?.address_name || null)
            } else resolve(null)
          })
        })
      } catch { /* 주소 변환 실패해도 좌표는 저장 */ }

      const { error } = await supabase.rpc('update_place_location', {
        p_place_id: placeId,
        p_lat: center.lat,
        p_lng: center.lng,
        p_address: newAddr,
      })
      if (error) throw new Error(error.message)

      onToast?.('위치를 수정했어요', '📍')
      onSaved()
    } catch (e: any) {
      onToast?.(e?.message ?? '위치 수정에 실패했어요', '⚠️')
    } finally {
      setSaving(false)
    }
  }

  const moved = Math.abs(center.lat - lat) > 1e-6 || Math.abs(center.lng - lng) > 1e-6

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', maxWidth: 'var(--app-max)', margin: '0 auto', background: 'var(--bg)', zIndex: 320, display: 'flex', flexDirection: 'column' }}>
      <Header left={<BackButton onClick={onClose} />} title="위치 수정" />

      <div style={{ padding: '12px 16px', background: 'var(--coral-soft)', flexShrink: 0 }}>
        <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 2px' }}>{placeName}</p>
        <p style={{ fontSize: '12px', color: 'var(--coral)', fontWeight: 600, margin: 0 }}>
          지도를 움직여 실제 가게 위치에 핀을 맞춰주세요
        </p>
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

        {/* 중앙 고정 핀 */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 10, pointerEvents: 'none' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50% 50% 50% 4px',
            transform: 'rotate(-45deg)', background: 'var(--coral)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(255,90,95,0.4)',
          }}>
            <span style={{ transform: 'rotate(45deg)', fontSize: '18px' }}>🧸</span>
          </div>
        </div>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -2px)', zIndex: 9, pointerEvents: 'none',
          width: '8px', height: '4px', borderRadius: '50%', background: 'rgba(0,0,0,0.2)',
        }} />

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--bg) 60%, transparent)', zIndex: 20 }}>
          <Button full size="lg" onClick={handleSave} disabled={!loaded || saving || !moved}>
            {saving ? '저장 중…' : moved ? '✓ 이 위치로 수정하기' : '지도를 움직여주세요'}
          </Button>
        </div>
      </div>
    </div>
  )
}
