'use client'
import { useEffect, useRef } from 'react'

declare global {
  interface Window { kakao: any }
}

/**
 * 장소 하나를 지도로 보여주는 전체화면 뷰.
 * 피드/마켓/제보에서 📍 장소를 눌렀을 때 사용.
 */
export function PlaceMapView({ name, address, lat, lng, onClose }: {
  name: string
  address?: string | null
  lat: number
  lng: number
  onClose: () => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    function draw() {
      if (cancelled || !mapRef.current || !window.kakao?.maps) return
      const center = new window.kakao.maps.LatLng(lat, lng)
      const map = new window.kakao.maps.Map(mapRef.current, { center, level: 3 })

      const el = document.createElement('div')
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;'
      el.innerHTML = `
        <div style="width:40px;height:40px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);
          background:#FF5A5F;display:flex;align-items:center;justify-content:center;
          box-shadow:0 4px 12px rgba(255,90,95,0.4);">
          <span style="transform:rotate(45deg);font-size:18px;">🧸</span>
        </div>`
      new window.kakao.maps.CustomOverlay({ position: center, content: el, yAnchor: 1.1, xAnchor: 0.5 }).setMap(map)
    }

    // 카카오 SDK 준비 후 그리기
    if (window.kakao?.maps?.Map) {
      draw()
    } else if (window.kakao?.maps) {
      window.kakao.maps.load(draw)
    } else {
      const existing = document.querySelector('script[src*="dapi.kakao.com"]')
      if (existing) {
        existing.addEventListener('load', () => window.kakao.maps.load(draw))
      } else {
        const script = document.createElement('script')
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&libraries=services&autoload=false`
        script.onload = () => window.kakao.maps.load(draw)
        document.head.appendChild(script)
      }
    }

    return () => { cancelled = true }
  }, [lat, lng])

  /** 카카오맵 앱/웹으로 길찾기 */
  function openKakaoMap() {
    window.open(`https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`, '_blank')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'var(--surface)', zIndex: 300, maxWidth: 'var(--app-max)', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <header style={{ height: 'var(--header-h)', padding: '0 8px 0 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: '40px', height: '40px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--ink-2)' }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
          {address && <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{address}</p>}
        </div>
      </header>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div ref={mapRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--surface) 60%, transparent)', zIndex: 5 }}>
          <button onClick={openKakaoMap} className="pressable" style={{ width: '100%', padding: '15px', borderRadius: 'var(--r-md)', background: 'var(--coral)', color: '#fff', fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-coral)' }}>
            🧭 카카오맵으로 길찾기
          </button>
        </div>
      </div>
    </div>
  )
}
