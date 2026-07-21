'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { timeAgo, formatPrice, marketStatus } from '@/lib/utils'
import { Spinner, EmptyState, Stat } from '@/components/ui'

declare global {
  interface Window { kakao: any }
}

type Post = {
  id: string
  title: string
  location: string | null
  place_name: string | null
  latitude: number | null
  longitude: number | null
  image_url: string | null
  nickname: string | null
  created_at: string
  like_count: number
  view_count: number
  comment_count: number
}

type MarketPin = {
  id: string
  title: string
  price: number | null
  is_free: boolean
  image_url: string | null
  status: string
  nickname: string | null
  created_at: string
  place_name: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  place_id: string | null
  like_count: number
  view_count: number
}

type PlaceWithItems = {
  place_name: string
  address: string
  lat: number
  lng: number
  posts: Post[]
  markets: MarketPin[]
  isKakao: boolean
}

type Props = {
  onSelectPost: (post: Post) => void
  onSelectMarket?: (marketId: string) => void
}

export default function MapTab({ onSelectPost, onSelectMarket }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [loaded, setLoaded] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'fail'>('loading')
  const [selectedPlace, setSelectedPlace] = useState<PlaceWithItems | null>(null)
  const [sheetTab, setSheetTab] = useState<'posts' | 'markets'>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [markets, setMarkets] = useState<MarketPin[]>([])
  const overlaysRef = useRef<any[]>([])
  const [showResearch, setShowResearch] = useState(false)
  const [researching, setResearching] = useState(false)

  useEffect(() => {
    supabase.from('posts').select('*').then(({ data }) => { if (data) setPosts(data) })
    supabase.from('market_items').select('*').neq('status', 'sold').then(({ data }) => { if (data) setMarkets(data) })

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

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('success')
      },
      () => {
        setUserLocation({ lat: 37.5665, lng: 126.9780 })
        setLocationStatus('fail')
      }
    )
  }, [])

  useEffect(() => {
    if (!loaded || !userLocation || !mapContainerRef.current) return
    initMap()
  }, [loaded, userLocation, posts, markets])

  function initMap() {
    if (!userLocation || !mapContainerRef.current) return
    if (mapContainerRef.current.offsetHeight === 0) {
      mapContainerRef.current.style.height = '100%'
      mapContainerRef.current.style.minHeight = '400px'
    }
    const center = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
    const map = new window.kakao.maps.Map(mapContainerRef.current, { center, level: 4 })
    mapRef.current = map

    if (locationStatus === 'success') {
      new window.kakao.maps.CustomOverlay({
        position: center,
        content: `<div style="width:18px;height:18px;border-radius:50%;background:#4A90E2;border:3px solid #fff;box-shadow:0 0 0 6px rgba(74,144,226,0.2),0 2px 6px rgba(74,144,226,0.5);"></div>`,
        yAnchor: 0.5, xAnchor: 0.5,
      }).setMap(map)
    }

    searchNearbyPlaces(map, userLocation)

    window.kakao.maps.event.addListener(map, 'dragend', () => setShowResearch(true))
    window.kakao.maps.event.addListener(map, 'zoom_changed', () => setShowResearch(true))
  }

  function matchPosts(placeName: string): Post[] {
    return posts.filter(p => p.place_name === placeName || (p.location ?? '').includes(placeName))
  }
  function matchMarkets(placeName: string): MarketPin[] {
    return markets.filter(m => m.place_name === placeName || (m.location ?? '').includes(placeName))
  }

  function searchNearbyPlaces(map: any, location: { lat: number; lng: number }) {
    const ps = new window.kakao.maps.services.Places()
    const center = new window.kakao.maps.LatLng(location.lat, location.lng)

    ps.keywordSearch('인형뽑기', (kakaoPlaces: any[], status: string) => {
      const places: PlaceWithItems[] = []

      if (status === window.kakao.maps.services.Status.OK) {
        kakaoPlaces.forEach((kp: any) => {
          places.push({
            place_name: kp.place_name,
            address: kp.road_address_name || kp.address_name,
            lat: parseFloat(kp.y), lng: parseFloat(kp.x),
            posts: matchPosts(kp.place_name),
            markets: matchMarkets(kp.place_name),
            isKakao: true,
          })
        })
      }

      // 카카오에 없는 자체 등록 업체
      // 가게 id가 있으면 그걸 기준으로 묶습니다. 이름 표기가 조금 달라도
      // 같은 가게면 핀 하나로 합쳐집니다. (id가 없는 옛 글만 이름으로 묶음)
      const kakaoNames = new Set(places.map(p => p.place_name))
      const customPlaces = new Map<string, PlaceWithItems>()

      const groupKey = (row: { place_id?: string | null; place_name?: string | null; location?: string | null }) =>
        row.place_id ?? row.place_name ?? row.location ?? ''

      posts.forEach(p => {
        const key = groupKey(p)
        const name = p.place_name ?? p.location ?? ''
        if (!key || kakaoNames.has(name) || !p.latitude || !p.longitude) return
        if (!customPlaces.has(key)) {
          customPlaces.set(key, {
            place_name: name, address: p.location ?? '',
            lat: p.latitude, lng: p.longitude,
            posts: [], markets: [], isKakao: false,
          })
        }
        customPlaces.get(key)!.posts.push(p)
      })

      markets.forEach(m => {
        const key = groupKey(m)
        const name = m.place_name ?? m.location ?? ''
        if (!key || kakaoNames.has(name) || !m.latitude || !m.longitude) return
        if (!customPlaces.has(key)) {
          customPlaces.set(key, {
            place_name: name, address: m.location ?? '',
            lat: m.latitude, lng: m.longitude,
            posts: [], markets: [], isKakao: false,
          })
        }
        if (!customPlaces.get(key)!.markets.some(x => x.id === m.id)) {
          customPlaces.get(key)!.markets.push(m)
        }
      })

      addMarkers(map, [...places, ...Array.from(customPlaces.values())])
    }, { location: center, radius: 2000, size: 15 })
  }

  function addMarkers(map: any, places: PlaceWithItems[]) {
    overlaysRef.current.forEach(o => o.setMap(null))
    overlaysRef.current = []

    places.forEach(place => {
      const position = new window.kakao.maps.LatLng(place.lat, place.lng)
      const totalCount = place.posts.length + place.markets.length
      const hasItem = totalCount > 0

      const el = document.createElement('div')
      el.className = 'bbop-marker'
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;'
      el.innerHTML = `
        <div style="position:relative;">
          <div style="width:40px;height:40px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);
            background:${hasItem ? '#FF5A5F' : '#fff'};
            border:2.5px solid ${hasItem ? '#FF5A5F' : '#E2DED8'};
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 4px 12px rgba(26,21,35,0.18);">
            <span style="transform:rotate(45deg);font-size:18px;">🧸</span>
          </div>
          ${hasItem ? `<div style="position:absolute;top:-6px;right:-8px;background:#FFC93C;color:#1A1523;
            border-radius:10px;padding:1px 6px;font-size:11px;font-weight:800;border:2px solid #fff;">${totalCount}</div>` : ''}
        </div>
        <div style="font-size:10.5px;color:#1A1523;margin-top:5px;background:rgba(255,255,255,0.95);
          padding:2px 7px;border-radius:6px;white-space:nowrap;max-width:90px;overflow:hidden;
          text-overflow:ellipsis;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.1);">${place.place_name}</div>`

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setSheetTab(place.posts.length > 0 ? 'posts' : (place.markets.length > 0 ? 'markets' : 'posts'))
        setSelectedPlace(place)
      })

      const overlay = new window.kakao.maps.CustomOverlay({
        position, content: el, yAnchor: 1.15, xAnchor: 0.5, clickable: true,
      })
      overlay.setMap(map)
      overlaysRef.current.push(overlay)
    })
  }

  function researchCurrentArea() {
    if (!mapRef.current) return
    setResearching(true)
    setShowResearch(false)
    const center = mapRef.current.getCenter()
    searchNearbyPlaces(mapRef.current, { lat: center.getLat(), lng: center.getLng() })
    setTimeout(() => setResearching(false), 1500)
  }

  function recenter() {
    if (mapRef.current && userLocation) {
      mapRef.current.setCenter(new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng))
      mapRef.current.setLevel(4)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        padding: '9px 16px', fontSize: '12.5px', fontWeight: 600, textAlign: 'center',
        background: locationStatus === 'success' ? 'var(--coral-soft)' : locationStatus === 'fail' ? 'var(--butter-soft)' : 'var(--surface-2)',
        color: locationStatus === 'success' ? 'var(--coral)' : locationStatus === 'fail' ? 'var(--warning)' : 'var(--ink-3)',
        flexShrink: 0,
      }}>
        {locationStatus === 'loading' && '📍 내 위치 찾는 중...'}
        {locationStatus === 'success' && '📍 내 주변 인형뽑기를 표시하고 있어요'}
        {locationStatus === 'fail' && '📍 위치 권한이 없어 서울 중심으로 표시 중'}
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: '300px' }}>
        {!loaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', zIndex: 5 }}>
            <Spinner label="지도 불러오는 중..." />
          </div>
        )}
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '300px' }} />

        {loaded && showResearch && (
          <button onClick={researchCurrentArea} className="pressable" style={{ position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, padding: '9px 18px', borderRadius: 'var(--r-full)', background: 'var(--surface)', border: 'none', boxShadow: 'var(--shadow-lg)', fontSize: '13px', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            {researching ? '🔍 검색 중...' : '🔍 이 위치에서 검색'}
          </button>
        )}

        {loaded && (
          <button onClick={recenter} className="pressable" aria-label="내 위치로" style={{ position: 'absolute', bottom: '18px', right: '16px', zIndex: 10, width: '46px', height: '46px', borderRadius: '50%', background: 'var(--surface)', border: 'none', boxShadow: 'var(--shadow-md)', fontSize: '20px', cursor: 'pointer' }}>🎯</button>
        )}
      </div>

      {selectedPlace && (
        <div onClick={() => setSelectedPlace(null)} style={{ position: 'absolute', inset: 0, zIndex: 15, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} className="animate-slide-up" style={{ width: '100%', background: 'var(--surface)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0', padding: '8px 20px 24px', maxHeight: '60%', overflowY: 'auto', boxShadow: '0 -8px 32px rgba(26,21,35,0.14)' }}>
            <div style={{ width: '40px', height: '4px', background: 'var(--surface-3)', borderRadius: 'var(--r-full)', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 4px' }}>{selectedPlace.place_name}</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{selectedPlace.address}</p>
              </div>
              <button onClick={() => setSelectedPlace(null)} style={{ fontSize: '18px', background: 'var(--surface-2)', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0 }}>✕</button>
            </div>

            {/* 탭 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button onClick={() => setSheetTab('posts')} style={{ flex: 1, padding: '9px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', fontSize: '13.5px', fontWeight: 700, background: sheetTab === 'posts' ? 'var(--coral)' : 'var(--surface-2)', color: sheetTab === 'posts' ? '#fff' : 'var(--ink-3)' }}>
                🔍 제보 {selectedPlace.posts.length > 0 && selectedPlace.posts.length}
              </button>
              <button onClick={() => setSheetTab('markets')} style={{ flex: 1, padding: '9px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', fontSize: '13.5px', fontWeight: 700, background: sheetTab === 'markets' ? 'var(--coral)' : 'var(--surface-2)', color: sheetTab === 'markets' ? '#fff' : 'var(--ink-3)' }}>
                🛍️ 마켓 {selectedPlace.markets.length > 0 && selectedPlace.markets.length}
              </button>
            </div>

            {sheetTab === 'posts' ? (
              selectedPlace.posts.length === 0 ? (
                <EmptyState emoji="🕳️" title="아직 제보가 없어요" desc="이 업체의 첫 제보를 남겨보세요!" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {selectedPlace.posts.map(post => (
                    <div key={post.id} onClick={() => { setSelectedPlace(null); onSelectPost(post) }} className="pressable" style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', cursor: 'pointer' }}>
                      <div style={{ width: '54px', height: '54px', borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {post.image_url ? <img src={post.image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '24px' }}>🧸</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</p>
                        <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: '0 0 4px' }}>{post.nickname ?? '익명'} · {timeAgo(post.created_at)}</p>
                        <div style={{ display: 'flex', gap: '9px' }}>
                          <Stat icon="👁" value={post.view_count ?? 0} />
                          <Stat icon="❤️" value={post.like_count ?? 0} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              selectedPlace.markets.length === 0 ? (
                <EmptyState emoji="🛍️" title="등록된 상품이 없어요" desc="여기서 뽑은 인형을 팔아보세요!" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {selectedPlace.markets.map(m => {
                    const badge = marketStatus(m.status)
                    return (
                      <div key={m.id} onClick={() => { setSelectedPlace(null); onSelectMarket?.(m.id) }} className="pressable" style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', cursor: 'pointer' }}>
                        <div style={{ width: '54px', height: '54px', borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {m.image_url ? <img src={m.image_url} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '24px' }}>🧸</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</p>
                          <p style={{ fontSize: '14px', fontWeight: 800, color: m.is_free ? 'var(--success)' : 'var(--ink)', margin: '0 0 3px' }}>{formatPrice(m.price, m.is_free)}</p>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: badge.color, background: badge.bg, padding: '2px 7px', borderRadius: 'var(--r-full)' }}>{badge.text}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
