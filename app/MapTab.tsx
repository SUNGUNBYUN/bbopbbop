'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { timeAgo } from '@/lib/utils'
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

type PlaceWithPosts = {
  place_name: string
  address: string
  lat: number
  lng: number
  posts: Post[]
  isKakao: boolean
}

type Props = {
  onSelectPost: (post: Post) => void
}

export default function MapTab({ onSelectPost }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [loaded, setLoaded] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'fail'>('loading')
  const [selectedPlace, setSelectedPlace] = useState<PlaceWithPosts | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const overlaysRef = useRef<any[]>([])

  useEffect(() => {
    supabase.from('posts').select('*').then(({ data }) => { if (data) setPosts(data) })

    if (window.kakao && window.kakao.maps) {
      setLoaded(true)
    } else {
      const script = document.createElement('script')
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&libraries=services&autoload=false`
      script.onload = () => window.kakao.maps.load(() => setLoaded(true))
      document.head.appendChild(script)
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('success')
      },
      () => {
        // 위치 실패 시 서울 시청 기본값
        setUserLocation({ lat: 37.5665, lng: 126.9780 })
        setLocationStatus('fail')
      }
    )
  }, [])

  useEffect(() => {
    if (!loaded || !userLocation || !mapContainerRef.current) return
    initMap()
  }, [loaded, userLocation])

  function initMap() {
    if (!userLocation || !mapContainerRef.current) return
    const center = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
    const map = new window.kakao.maps.Map(mapContainerRef.current, { center, level: 4 })
    mapRef.current = map

    // 내 위치 (성공 시만)
    if (locationStatus === 'success') {
      new window.kakao.maps.CustomOverlay({
        position: center,
        content: `<div style="width:18px;height:18px;border-radius:50%;background:#4A90E2;border:3px solid #fff;box-shadow:0 0 0 6px rgba(74,144,226,0.2),0 2px 6px rgba(74,144,226,0.5);"></div>`,
        yAnchor: 0.5, xAnchor: 0.5,
      }).setMap(map)
    }

    searchNearbyPlaces(map, userLocation)
  }

  function searchNearbyPlaces(map: any, location: { lat: number; lng: number }) {
    const ps = new window.kakao.maps.services.Places()
    const center = new window.kakao.maps.LatLng(location.lat, location.lng)

    ps.keywordSearch('인형뽑기', (kakaoPlaces: any[], status: string) => {
      if (status !== window.kakao.maps.services.Status.OK) { addMarkers(map, bbopOnly()); return }

      const placesWithPosts: PlaceWithPosts[] = kakaoPlaces.map((kp: any) => {
        const matchedPosts = posts.filter(p =>
          p.place_name === kp.place_name || (p.location ?? '').includes(kp.place_name)
        )
        return {
          place_name: kp.place_name,
          address: kp.road_address_name || kp.address_name,
          lat: parseFloat(kp.y), lng: parseFloat(kp.x),
          posts: matchedPosts, isKakao: true,
        }
      })

      const bbopPosts = posts.filter(p =>
        p.latitude && p.longitude &&
        !kakaoPlaces.some((kp: any) => p.place_name === kp.place_name)
      )
      const bbopPlaces: PlaceWithPosts[] = bbopPosts.map(p => ({
        place_name: p.place_name ?? p.location ?? '업체',
        address: p.location ?? '', lat: p.latitude!, lng: p.longitude!,
        posts: [p], isKakao: false,
      }))

      addMarkers(map, [...placesWithPosts, ...bbopPlaces])
    }, { location: center, radius: 2000, size: 15 })
  }

  function bbopOnly(): PlaceWithPosts[] {
    return posts.filter(p => p.latitude && p.longitude).map(p => ({
      place_name: p.place_name ?? p.location ?? '업체',
      address: p.location ?? '', lat: p.latitude!, lng: p.longitude!,
      posts: [p], isKakao: false,
    }))
  }

  function addMarkers(map: any, places: PlaceWithPosts[]) {
    overlaysRef.current.forEach(o => o.setMap(null))
    overlaysRef.current = []

    places.forEach(place => {
      const position = new window.kakao.maps.LatLng(place.lat, place.lng)
      const postCount = place.posts.length
      const hasPost = postCount > 0

      const markerContent = `
        <div class="bbop-marker" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
          <div style="position:relative;">
            <div style="width:40px;height:40px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);
              background:${hasPost ? '#FF5A5F' : '#fff'};
              border:2.5px solid ${hasPost ? '#FF5A5F' : '#E2DED8'};
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 4px 12px rgba(26,21,35,0.18);">
              <span style="transform:rotate(45deg);font-size:18px;">🧸</span>
            </div>
            ${hasPost ? `<div style="position:absolute;top:-6px;right:-8px;background:#FFC93C;color:#1A1523;
              border-radius:10px;padding:1px 6px;font-size:11px;font-weight:800;border:2px solid #fff;">${postCount}</div>` : ''}
          </div>
          <div style="font-size:10.5px;color:#1A1523;margin-top:5px;background:rgba(255,255,255,0.95);
            padding:2px 7px;border-radius:6px;white-space:nowrap;max-width:90px;overflow:hidden;
            text-overflow:ellipsis;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.1);">${place.place_name}</div>
        </div>`

      const overlay = new window.kakao.maps.CustomOverlay({
        position, content: markerContent, yAnchor: 1.15, xAnchor: 0.5,
      })
      overlay.setMap(map)
      overlaysRef.current.push(overlay)

      setTimeout(() => {
        const el = overlay.getContent()
        if (el && typeof el !== 'string') {
          el.addEventListener('click', () => setSelectedPlace(place))
        }
      }, 100)
    })
  }

  function recenter() {
    if (mapRef.current && userLocation) {
      mapRef.current.setCenter(new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng))
      mapRef.current.setLevel(4)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* 상태 배너 */}
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

      {/* 지도 */}
      <div style={{ flex: 1, position: 'relative' }}>
        {!loaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', zIndex: 5 }}>
            <Spinner label="지도 불러오는 중..." />
          </div>
        )}
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* 내 위치 버튼 */}
        {loaded && (
          <button
            onClick={recenter}
            className="pressable"
            aria-label="내 위치로"
            style={{
              position: 'absolute', bottom: '18px', right: '16px', zIndex: 10,
              width: '46px', height: '46px', borderRadius: '50%', background: 'var(--surface)',
              border: 'none', boxShadow: 'var(--shadow-md)', fontSize: '20px', cursor: 'pointer',
            }}
          >🎯</button>
        )}
      </div>

      {/* 업체 시트 */}
      {selectedPlace && (
        <div
          onClick={() => setSelectedPlace(null)}
          style={{ position: 'absolute', inset: 0, zIndex: 15, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-slide-up"
            style={{
              width: '100%', background: 'var(--surface)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
              padding: '8px 20px 24px', maxHeight: '55%', overflowY: 'auto',
              boxShadow: '0 -8px 32px rgba(26,21,35,0.14)',
            }}
          >
            <div style={{ width: '40px', height: '4px', background: 'var(--surface-3)', borderRadius: 'var(--r-full)', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 4px' }}>{selectedPlace.place_name}</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--ink-3)', margin: 0 }}>{selectedPlace.address}</p>
              </div>
              <button onClick={() => setSelectedPlace(null)} style={{ fontSize: '18px', background: 'var(--surface-2)', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0 }}>✕</button>
            </div>

            {selectedPlace.posts.length === 0 ? (
              <EmptyState emoji="🕳️" title="아직 제보가 없어요" desc="이 업체의 첫 제보를 남겨보세요!" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {selectedPlace.posts.map(post => (
                  <div
                    key={post.id}
                    onClick={() => { setSelectedPlace(null); onSelectPost(post) }}
                    className="pressable"
                    style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', cursor: 'pointer' }}
                  >
                    <div style={{ width: '54px', height: '54px', borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {post.image_url ? <img src={post.image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '24px' }}>🧸</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</p>
                      <p style={{ fontSize: '11.5px', color: 'var(--ink-4)', margin: '0 0 4px' }}>{post.nickname ?? '익명'} · {timeAgo(post.created_at)}</p>
                      <div style={{ display: 'flex', gap: '9px' }}>
                        <Stat icon="👁" value={post.view_count ?? 0} />
                        <Stat icon="❤️" value={post.like_count ?? 0} />
                        <Stat icon="💬" value={post.comment_count ?? 0} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
