'use client'
import { useState, useEffect, useRef } from 'react'
import { Place, User } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { PlaceRegister } from './PlaceRegister'

declare global {
  interface Window { kakao: any }
}

// 두 좌표 간 거리 (미터)
function dist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`
  return `${(m / 1000).toFixed(1)}km`
}

/** 업체 검색 + 지도 미리보기 + 직접 등록 (제보/마켓 공용) */
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
  const [mapPreview, setMapPreview] = useState<Place | null>(null)
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMyLoc(null)
    )
  }, [])

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

  /** 우리 DB(직접 등록된 업체) 검색 */
  async function searchOurPlaces(q: string): Promise<Place[]> {
    const { data } = await supabase
      .from('places')
      .select('place_name, address, latitude, longitude')
      .ilike('place_name', `%${q}%`)
      .limit(15)
    if (!data) return []
    return data.map((p: any) => ({
      place_name: p.place_name,
      address_name: p.address ?? '',
      road_address_name: p.address ?? '',
      x: String(p.longitude),
      y: String(p.latitude),
      is_ours: true,
    }))
  }

  /** 카카오 키워드 검색 */
  function searchKakao(q: string): Promise<Place[]> {
    return new Promise((resolve) => {
      if (!kakaoReady || !window.kakao?.maps?.services) { resolve([]); return }
      const ps = new window.kakao.maps.services.Places()
      const options: any = {}
      if (myLoc) {
        options.location = new window.kakao.maps.LatLng(myLoc.lat, myLoc.lng)
        options.radius = 20000 // 20km 이내 우선
        options.sort = window.kakao.maps.services.SortBy.DISTANCE
      }
      ps.keywordSearch(q, (data: any[], status: string) => {
        if (status === window.kakao.maps.services.Status.OK) {
          resolve(data.map((p: any) => ({
            place_name: p.place_name,
            address_name: p.address_name,
            road_address_name: p.road_address_name,
            x: p.x,
            y: p.y,
            category_name: p.category_name,
            category_group_code: p.category_group_code,
          })))
        } else {
          resolve([])
        }
      }, options)
    })
  }

  async function search() {
    const q = query.trim()
    if (!q) return
    setSearching(true)

    const [ours, kakao] = await Promise.all([
      searchOurPlaces(q).catch(() => [] as Place[]),
      searchKakao(q).catch(() => [] as Place[]),
    ])

    // 같은 업체가 양쪽에 있으면 우리 DB 것을 우선 (이름 같고 30m 이내면 중복으로 봄)
    const merged: Place[] = [...ours]
    for (const k of kakao) {
      const dup = ours.some(o =>
        o.place_name.replace(/\s/g, '') === k.place_name.replace(/\s/g, '') &&
        dist(parseFloat(o.y), parseFloat(o.x), parseFloat(k.y), parseFloat(k.x)) < 30
      )
      if (!dup) merged.push(k)
    }

    // 내 위치 있으면: 우리 DB 먼저, 그 안에서 가까운 순
    const sorted = myLoc
      ? merged.sort((a, b) => {
          if (!!a.is_ours !== !!b.is_ours) return a.is_ours ? -1 : 1
          return dist(myLoc.lat, myLoc.lng, parseFloat(a.y), parseFloat(a.x)) -
                 dist(myLoc.lat, myLoc.lng, parseFloat(b.y), parseFloat(b.x))
        })
      : merged

    setResults(sorted)
    setSearching(false)
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

  // 지도 미리보기 화면
  if (mapPreview) {
    return <MapPreview place={mapPreview} onBack={() => setMapPreview(null)} onConfirm={() => onSelect(mapPreview)} />
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,35,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 'var(--app-max)', margin: '0 auto', background: 'var(--surface)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0', padding: '20px', maxHeight: '75dvh', display: 'flex', flexDirection: 'column' }}>
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
            <div key={i} style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 4px' }}>
                <p style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{place.place_name}</p>
                {place.is_ours && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', background: 'var(--mint-soft)', padding: '2px 7px', borderRadius: 'var(--r-full)', flexShrink: 0 }}>
                    뽑뽑 등록
                  </span>
                )}
                {myLoc && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--coral)', background: 'var(--coral-soft)', padding: '2px 7px', borderRadius: 'var(--r-full)', flexShrink: 0 }}>
                    {formatDist(dist(myLoc.lat, myLoc.lng, parseFloat(place.y), parseFloat(place.x)))}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: '0 0 10px' }}>{place.road_address_name || place.address_name}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setMapPreview(place)} style={{ flex: 1, padding: '9px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>🗺️ 지도로 보기</button>
                <button onClick={() => onSelect(place)} style={{ flex: 1, padding: '9px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--coral)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>선택</button>
              </div>
            </div>
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

/** 선택한 업체 위치를 지도로 확인 */
function MapPreview({ place, onBack, onConfirm }: { place: Place; onBack: () => void; onConfirm: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return
    const lat = parseFloat(place.y)
    const lng = parseFloat(place.x)
    const center = new window.kakao.maps.LatLng(lat, lng)
    const map = new window.kakao.maps.Map(mapRef.current, { center, level: 3 })

    // 마커
    const el = document.createElement('div')
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;'
    el.innerHTML = `
      <div style="width:40px;height:40px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);
        background:#FF5A5F;display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 12px rgba(255,90,95,0.4);">
        <span style="transform:rotate(45deg);font-size:18px;">🧸</span>
      </div>`
    new window.kakao.maps.CustomOverlay({ position: center, content: el, yAnchor: 1.1, xAnchor: 0.5 }).setMap(map)
  }, [place])

  return (
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', background: 'var(--surface)', zIndex: 210, maxWidth: 'var(--app-max)', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <header style={{ height: 'var(--header-h)', padding: '0 8px 0 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ width: '40px', height: '40px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--ink-2)' }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.place_name}</p>
          <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.road_address_name || place.address_name}</p>
        </div>
        <button onClick={onConfirm} className="pressable" style={{ flexShrink: 0, padding: '9px 16px', borderRadius: 'var(--r-full)', background: 'var(--coral)', color: '#fff', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>선택</button>
      </header>

      {/* 지도 + 버튼(지도 위 오버레이) — iOS에서도 버튼이 항상 보이도록 */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div ref={mapRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--surface) 60%, transparent)', zIndex: 5 }}>
          <button onClick={onConfirm} className="pressable" style={{ width: '100%', padding: '15px', borderRadius: 'var(--r-md)', background: 'var(--coral)', color: '#fff', fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-coral)' }}>
            ✓ 이 업체로 선택하기
          </button>
        </div>
      </div>
    </div>
  )
}
