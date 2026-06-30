'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
  const markersRef = useRef<any[]>([])
  const overlaysRef = useRef<any[]>([])

  useEffect(() => {
    // 게시물 불러오기
    supabase.from('posts').select('*').then(({ data }) => {
      if (data) setPosts(data)
    })

    // 카카오맵 로드
    if (window.kakao && window.kakao.maps) {
      setLoaded(true)
    } else {
      const script = document.createElement('script')
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&libraries=services&autoload=false`
      script.onload = () => window.kakao.maps.load(() => setLoaded(true))
      document.head.appendChild(script)
    }

    // 내 위치 가져오기
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('success')
      },
      () => setLocationStatus('fail')
    )
  }, [])

  useEffect(() => {
    if (!loaded || !userLocation || !mapContainerRef.current) return
    initMap()
  }, [loaded, userLocation])

  function initMap() {
    if (!userLocation || !mapContainerRef.current) return

    const center = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
    const map = new window.kakao.maps.Map(mapContainerRef.current, {
      center,
      level: 4,
    })
    mapRef.current = map

    // 내 위치 표시
    const myMarkerContent = `
      <div style="
        width: 16px; height: 16px; border-radius: 50%;
        background: #4A90E2; border: 3px solid #fff;
        box-shadow: 0 2px 6px rgba(74,144,226,0.5);
      "></div>
    `
    new window.kakao.maps.CustomOverlay({
      position: center,
      content: myMarkerContent,
      yAnchor: 0.5,
      xAnchor: 0.5,
    }).setMap(map)

    // 주변 인형뽑기 검색
    searchNearbyPlaces(map, userLocation)
  }

  function searchNearbyPlaces(map: any, location: { lat: number; lng: number }) {
    const ps = new window.kakao.maps.services.Places()
    const center = new window.kakao.maps.LatLng(location.lat, location.lng)

    ps.keywordSearch('인형뽑기', (kakaoPlaces: any[], status: string) => {
      if (status !== window.kakao.maps.services.Status.OK) return

      // 카카오 업체랑 뽑뽑 제보 매칭
      const placesWithPosts: PlaceWithPosts[] = kakaoPlaces.map((kp: any) => {
        const lat = parseFloat(kp.y)
        const lng = parseFloat(kp.x)
        // 해당 업체 이름과 매칭되는 제보 찾기
        const matchedPosts = posts.filter(p =>
          p.place_name === kp.place_name ||
          (p.location ?? '').includes(kp.place_name)
        )
        return {
          place_name: kp.place_name,
          address: kp.road_address_name || kp.address_name,
          lat,
          lng,
          posts: matchedPosts,
          isKakao: true,
        }
      })

      // 뽑뽑에만 있는 제보 (좌표 있는 것)
      const bbopPosts = posts.filter(p =>
        p.latitude && p.longitude &&
        !kakaoPlaces.some((kp: any) => p.place_name === kp.place_name)
      )
      const bbopPlaces: PlaceWithPosts[] = bbopPosts.map(p => ({
        place_name: p.place_name ?? p.location ?? '업체',
        address: p.location ?? '',
        lat: p.latitude!,
        lng: p.longitude!,
        posts: [p],
        isKakao: false,
      }))

      const allPlaces = [...placesWithPosts, ...bbopPlaces]
      addMarkers(map, allPlaces)
    }, {
      location: center,
      radius: 2000,
      size: 15,
    })
  }

  function addMarkers(map: any, places: PlaceWithPosts[]) {
    // 기존 마커 제거
    markersRef.current.forEach(m => m.setMap(null))
    overlaysRef.current.forEach(o => o.setMap(null))
    markersRef.current = []
    overlaysRef.current = []

    places.forEach(place => {
      const position = new window.kakao.maps.LatLng(place.lat, place.lng)
      const postCount = place.posts.length
      const hasPost = postCount > 0

      // 마커 커스텀 오버레이
      const markerContent = `
        <div style="
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
        ">
          <div style="
            width: 36px; height: 36px; border-radius: 50%;
            background: ${hasPost ? '#FF6B6B' : '#fff'};
            border: 2.5px solid ${hasPost ? '#FF6B6B' : '#ccc'};
            display: flex; align-items: center; justify-content: center;
            font-size: 18px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          ">🧸</div>
          ${hasPost ? `
            <div style="
              position: absolute; top: -6px; right: -6px;
              background: #FF6B6B; color: #fff;
              border-radius: 10px; padding: 1px 5px;
              font-size: 10px; font-weight: 700;
              border: 1.5px solid #fff;
            ">${postCount}</div>
          ` : ''}
          <div style="
            font-size: 10px; color: #444; margin-top: 3px;
            background: rgba(255,255,255,0.9); padding: 2px 5px;
            border-radius: 4px; white-space: nowrap;
            max-width: 80px; overflow: hidden; text-overflow: ellipsis;
          ">${place.place_name}</div>
        </div>
      `

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: markerContent,
        yAnchor: 1.2,
        xAnchor: 0.5,
      })
      overlay.setMap(map)
      overlaysRef.current.push(overlay)

      // 클릭 이벤트
      setTimeout(() => {
        const el = overlay.getContent()
        if (el && typeof el !== 'string') {
          el.addEventListener('click', () => {
            setSelectedPlace(place)
          })
        }
      }, 100)
    })
  }

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return '방금 전'
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
    return `${Math.floor(diff / 86400)}일 전`
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* 위치 상태 */}
      <div style={{ padding: '8px 16px', fontSize: '12px', backgroundColor: locationStatus === 'success' ? '#FFF5F5' : '#fafafa', color: locationStatus === 'success' ? '#FF6B6B' : '#aaa', textAlign: 'center' }}>
        {locationStatus === 'loading' && '📍 내 위치 가져오는 중...'}
        {locationStatus === 'success' && '📍 내 주변 인형뽑기 업체를 표시하고 있어요'}
        {locationStatus === 'fail' && '📍 위치 권한을 허용해주세요'}
      </div>

      {/* 지도 */}
      <div ref={mapContainerRef} style={{ flex: 1 }} />

      {/* 업체 제보 목록 팝업 */}
      {selectedPlace && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderRadius: '20px 20px 0 0', padding: '20px', maxHeight: '50%', overflowY: 'auto', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#222', margin: '0 0 2px' }}>{selectedPlace.place_name}</h3>
              <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{selectedPlace.address}</p>
            </div>
            <button onClick={() => setSelectedPlace(null)} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>✕</button>
          </div>

          {selectedPlace.posts.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#bbb', textAlign: 'center', padding: '20px 0' }}>
              아직 제보가 없어요 😢<br />
              <span style={{ fontSize: '12px' }}>첫 번째로 제보해보세요!</span>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedPlace.posts.map(post => (
                <div
                  key={post.id}
                  onClick={() => { setSelectedPlace(null); onSelectPost(post) }}
                  style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px', borderRadius: '10px', border: '1px solid #f0f0f0', cursor: 'pointer' }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {post.image_url ? (
                      <img src={post.image_url} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '22px' }}>🧸</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#222', margin: '0 0 3px' }}>{post.title}</p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#bbb' }}>{post.nickname ?? '익명'} · {timeAgo(post.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', color: '#bbb' }}>👁️ {post.view_count ?? 0}</span>
                      <span style={{ fontSize: '11px', color: '#bbb' }}>❤️ {post.like_count ?? 0}</span>
                      <span style={{ fontSize: '11px', color: '#bbb' }}>💬 {post.comment_count ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}