// 앱 전역 공유 타입

export type User = {
  id: string
  email: string
  nickname: string
}

export type Post = {
  id: string
  title: string
  /** 이 기계에 들어있는 인형 목록 (기계 1대 = 제보 1개) */
  products: string[] | null
  location: string | null
  tags: string | null
  image_url: string | null
  images: string[] | null
  created_at: string
  user_id: string | null
  nickname: string | null
  view_count: number
  like_count: number
  comment_count: number
  latitude: number | null
  longitude: number | null
  place_name: string | null
  verify_count?: number
  last_verified_at?: string | null
  reward_confirmed?: boolean
  hidden?: boolean
  place_id?: string | null
}

export type Comment = {
  id: string
  post_id: string
  user_id: string
  nickname: string | null
  content: string
  created_at: string
}

export type Place = {
  place_name: string
  address_name: string
  road_address_name: string
  x: string
  y: string
  category_name?: string
  category_group_code?: string
  /** 카카오 장소 고유 ID — 같은 가게인지 판별하는 가장 확실한 키 */
  kakao_id?: string
  /** 뽑뽑에 직접 등록된 업체(카카오 검색에 없는 곳) */
  is_ours?: boolean
}

export type SortKey = 'recent' | 'popular' | 'comments'

export type MarketItem = {
  id: string
  title: string
  description: string | null
  price: number | null
  is_free: boolean
  trade_type: string
  image_url: string | null
  images: string[] | null
  status: string
  user_id: string
  nickname: string | null
  location: string | null
  latitude: number | null
  longitude: number | null
  place_name: string | null
  view_count: number
  like_count: number
  created_at: string
  updated_at: string | null
  bumped_at: string | null
  pinned_until: string | null
  highlight_until: string | null
}

export type FeedPost = {
  id: string
  content: string | null
  image_url: string | null
  images: string[] | null
  user_id: string
  nickname: string | null
  like_count: number
  comment_count: number
  location: string | null
  latitude: number | null
  longitude: number | null
  place_name: string | null
  created_at: string
  updated_at: string | null
}
