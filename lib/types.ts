// 앱 전역 공유 타입

export type User = {
  id: string
  email: string
  nickname: string
}

export type Post = {
  id: string
  title: string
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
  view_count: number
  like_count: number
  created_at: string
}

export type FeedPost = {
  id: string
  content: string | null
  image_url: string | null
  user_id: string
  nickname: string | null
  like_count: number
  comment_count: number
  created_at: string
}
