'use client'
import { useEffect, useState, useRef } from 'react'

declare global {
  interface Window { kakao: any }
}

type Place = {
  place_name: string
  address_name: string
  road_address_name: string
  x: string
  y: string
  distance?: string
}

type Props = {
  onSelect: (place: Place) => void
  onClose: () => void
}

export default function KakaoPlaceSearch({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [hasPrev, setHasPrev] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'fail'>('loading')
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const myLocationMarkerRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      setLoaded(true)
    } else {
      const script = document.createElement('script')
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&libraries=services&autoload=false`
      script.onload = () => window.kakao.maps.load(() => setLoaded(true))
      script.onerror = () => setError('카카오맵 로드 실패')
      document.head.appendChild(script)
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('success')
      },
      () => setLocationStatus('fail')
    )
  }, [])

  useEffect(() => {
    if (!selectedPlace || !loaded || !mapContainerRef.current) return
    setTimeout(() => {
      const lat = parseFloat(selectedPlace.y)
      const lng = parseFloat(selectedPlace.x)
      const center = new window.kakao.maps.LatLng(lat, lng)

      if (!mapRef.current) {
        mapRef.current = new window.kakao.maps.Map(mapContainerRef.current, { center, level: 3 })
      } else {
        mapRef.current.setCenter(center)
      }

      if (markerRef.current) markerRef.current.setMap(null)
      markerRef.current = new window.kakao.maps.Marker({ position: center })
      markerRef.current.setMap(mapRef.current)

      if (userLocation) {
        const myPos = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
        if (myLocationMarkerRef.current) myLocationMarkerRef.current.setMap(null)
        const myMarkerContent = `
          <div style="
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #4A90E2;
            border: 3px solid #fff;
            box-shadow: 0 2px 6px rgba(74,144,226,0.5);
          "></div>
        `
        myLocationMarkerRef.current = new window.kakao.maps.CustomOverlay({
          position: myPos,
          content: myMarkerContent,
          yAnchor: 0.5,
          xAnchor: 0.5,
        })
        myLocationMarkerRef.current.setMap(mapRef.current)
      }
    }, 100)
  }, [selectedPlace, loaded, userLocation])

  function handleSearch(pageNum = 1) {
    if (!query.trim()) return
    if (!loaded) {
      setError('카카오맵 로딩 중이에요. 잠시 후 다시 시도해주세요.')
      return
    }
    setSelectedPlace(null)
    try {
      const ps = new window.kakao.maps.services.Places()
      const options: any = { size: 8, page: pageNum }
      if (userLocation) {
        options.location = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
        options.sort = window.kakao.maps.services.SortBy.DISTANCE
      }
      ps.keywordSearch(query, (data: Place[], status: string, pagination: any) => {
        if (status === window.kakao.maps.services.Status.OK) {
          setResults(data)
          setPage(pageNum)
          setHasNext(pagination.hasNextPage)
          setHasPrev(pagination.hasPrevPage)
          setError('')
        } else {
          setResults([])
          setError('검색 결과가 없어요')
        }
      }, options)
    } catch (e) {
      setError('검색 중 오류가 발생했어요')
    }
  }

  function formatDistance(distance?: string) {
    if (!distance) return ''
    const m = parseInt(distance)
    if (m < 1000) return `${m}m`
    return `${(m / 1000).toFixed(1)}km`
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', maxWidth: '430px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* 헤더 */}
        <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>업체 검색</h3>
          <button onClick={onClose} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        {/* 지도 — 업체 선택 시 표시 */}
        {selectedPlace && (
          <div style={{ position: 'relative' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '180px' }} />
            <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '8px', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#444' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#4A90E2', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(74,144,226,0.5)' }} />
                내 위치
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#444' }}>
                <div style={{ width: '10px', height: '14px', backgroundColor: '#FF6B6B', borderRadius: '2px' }} />
                선택 업체
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.95)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#222', margin: '0 0 2px' }}>{selectedPlace.place_name}</p>
                <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{selectedPlace.road_address_name || selectedPlace.address_name}</p>
              </div>
              <button
                onClick={() => onSelect(selectedPlace)}
                style={{ padding: '8px 16px', borderRadius: '10px', backgroundColor: '#FF6B6B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', flexShrink: 0, marginLeft: '12px' }}
              >이 업체 선택</button>
            </div>
          </div>
        )}

        <div style={{ padding: '0 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* 위치 상태 */}
          <div style={{ fontSize: '12px', margin: '8px 0', padding: '6px 10px', borderRadius: '8px', backgroundColor: locationStatus === 'success' ? '#FFF5F5' : '#fafafa', color: locationStatus === 'success' ? '#FF6B6B' : '#aaa' }}>
            {locationStatus === 'loading' && '📍 내 위치 가져오는 중...'}
            {locationStatus === 'success' && '📍 내 위치 기준 가까운 순으로 검색돼요'}
            {locationStatus === 'fail' && '📍 위치 권한 없음 — 일반 검색으로 진행해요'}
          </div>

          {/* 검색창 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="인형뽑기 업체명으로 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(1)}
              style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa' }}
            />
            <button
              onClick={() => handleSearch(1)}
              style={{ padding: '10px 16px', borderRadius: '10px', backgroundColor: '#FF6B6B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' }}
            >검색</button>
          </div>

          {!loaded && <p style={{ fontSize: '12px', color: '#aaa', textAlign: 'center', margin: '0 0 8px' }}>🗺️ 카카오맵 로딩 중...</p>}
          {error && <p style={{ fontSize: '12px', color: '#FF6B6B', margin: '0 0 8px' }}>⚠ {error}</p>}

          {/* 검색 결과 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '12px' }}>
            {results.length === 0 && !error ? (
              <p style={{ color: '#bbb', textAlign: 'center', marginTop: '40px', fontSize: '14px' }}>
                업체명으로 검색해보세요 🔍
              </p>
            ) : (
              results.map((place, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedPlace(place)}
                  style={{ padding: '12px', borderRadius: '10px', border: `1.5px solid ${selectedPlace?.place_name === place.place_name ? '#FF6B6B' : '#f0f0f0'}`, cursor: 'pointer', backgroundColor: selectedPlace?.place_name === place.place_name ? '#FFF5F5' : '#fff' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#222', margin: '0 0 4px' }}>{place.place_name}</p>
                    {place.distance && (
                      <span style={{ fontSize: '12px', color: '#FF6B6B', fontWeight: '600', flexShrink: 0, marginLeft: '8px' }}>
                        {formatDistance(place.distance)}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>{place.road_address_name || place.address_name}</p>
                </div>
              ))
            )}
          </div>

          {/* 페이지 넘기기 */}
          {results.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0', marginBottom: '12px' }}>
              <button
                onClick={() => handleSearch(page - 1)}
                disabled={!hasPrev}
                style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid #f0f0f0', backgroundColor: !hasPrev ? '#fafafa' : '#fff', color: !hasPrev ? '#ccc' : '#444', cursor: !hasPrev ? 'default' : 'pointer', fontSize: '13px' }}
              >← 이전</button>
              <span style={{ fontSize: '13px', color: '#888' }}>{page} 페이지</span>
              <button
                onClick={() => handleSearch(page + 1)}
                disabled={!hasNext}
                style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid #f0f0f0', backgroundColor: !hasNext ? '#fafafa' : '#fff', color: !hasNext ? '#ccc' : '#444', cursor: !hasNext ? 'default' : 'pointer', fontSize: '13px' }}
              >다음 →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}