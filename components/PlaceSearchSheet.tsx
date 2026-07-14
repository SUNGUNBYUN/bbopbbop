'use client'
import { useState, useEffect } from 'react'
import { Place, User } from '@/lib/types'
import { PlaceRegister } from './PlaceRegister'

declare global {
  interface Window { kakao: any }
}

/** 업체 검색 + 직접 등록 시트 (제보/마켓 공용) */
export function PlaceSearchSheet({ user, onSelect, onClose }: {
  user: User
  onSelect: (place: Place) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [showRegister, setShowRegister] = useState(false)
  const [kakaoReady, setKakaoReady] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      setKakaoReady(true)
    } else if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => setKakaoReady(true))
    } else {
      const existing = document.querySelector('script[src*="dapi.kakao.com"]')
      if (existing) {
        existing.addEventListener('load', () => window.kakao.maps.load(() => setKakaoReady(true)))
      } else {
        const script = document.createElement('script')
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&libraries=services&autoload=false`
        script.onload = () => window.kakao.maps.load(() => setKakaoReady(true))
        document.head.appendChild(script)
      }
    }
  }, [])

  function search() {
    if (!query.trim()) return
    if (!kakaoReady || !window.kakao?.maps?.services) return
    setSearching(true)
    const ps = new window.kakao.maps.services.Places()
    ps.keywordSearch(query, (data: any[], status: string) => {
      setSearching(false)
      if (status === window.kakao.maps.services.Status.OK) {
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

  if (showRegister) {
    return (
      <PlaceRegister
        user={user}
        onClose={() => setShowRegister(false)}
        onRegistered={(place) => { setShowRegister(false); onSelect(place) }}
      />
    )
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
          <button onClick={search} disabled={!kakaoReady || searching} style={{ padding: '12px 18px', borderRadius: 'var(--r-md)', background: kakaoReady ? 'var(--coral)' : 'var(--ink-4)', color: '#fff', border: 'none', fontWeight: 700, cursor: kakaoReady ? 'pointer' : 'default', fontSize: '14px', whiteSpace: 'nowrap' }}>{searching ? '검색중' : !kakaoReady ? '로딩중' : '검색'}</button>
        </div>
        <div className="no-scrollbar" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {results.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px', padding: '16px 0' }}>업체명으로 검색하거나<br/>아래에서 직접 등록하세요</p>
          )}
          {results.map((place, i) => (
            <button key={i} onClick={() => onSelect(place)} style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <p style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px' }}>{place.place_name}</p>
              <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{place.road_address_name || place.address_name}</p>
            </button>
          ))}

          <button
            onClick={() => setShowRegister(true)}
            style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px dashed var(--coral)', background: 'var(--coral-soft)', cursor: 'pointer', textAlign: 'center', width: '100%', marginTop: '4px' }}
          >
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--coral)', margin: '0 0 2px' }}>🗺️ 찾는 업체가 없나요?</p>
            <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0 }}>지도에서 직접 위치를 등록해보세요</p>
          </button>
        </div>
      </div>
    </div>
  )
}
