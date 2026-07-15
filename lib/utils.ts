// 공통 유틸리티

/** 상대 시간 표시 (예: "3분 전") */
export function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 5) return '방금 전'
  if (diff < 60) return `${diff}초 전`
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 가격 포맷 (예: 12000 → "12,000원") */
export function formatPrice(price: number | null, isFree: boolean): string {
  if (isFree) return '나눔'
  return `${(price ?? 0).toLocaleString()}원`
}

/** 숫자 축약 (예: 1500 → "1.5천", 12000 → "1.2만") */
export function compactNumber(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}천`
  return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`
}

/** 클래스명 병합 헬퍼 */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** 거래 방식 텍스트 */
export function tradeTypeText(type: string): string {
  const map: Record<string, string> = {
    direct: '직거래',
    delivery: '택배',
    exchange: '교환',
    both: '직거래·택배',
  }
  return map[type] ?? '직거래·택배'
}

/** 마켓 상태 뱃지 정보 */
export function marketStatus(status: string) {
  if (status === 'reserved') return { text: '예약중', color: 'var(--warning)', bg: 'var(--butter-soft)' }
  if (status === 'sold') return { text: '거래완료', color: 'var(--ink-3)', bg: 'var(--surface-3)' }
  return { text: '판매중', color: 'var(--coral)', bg: 'var(--coral-soft)' }
}


/** 정보 신선도 상태 (재인증 기준) */
export type Freshness = { level: 'fresh' | 'aging' | 'stale'; label: string; color: string; bg: string; days: number }

/**
 * last_verified_at(없으면 created_at) 기준으로 신선도 계산.
 *  - 7일 이내: FRESH (초록 "최근 확인")
 *  - 8~30일: AGING (회색 "○일 전 확인")
 *  - 30일+: STALE (흐림 "오래된 정보")
 */
export function freshness(lastVerifiedAt?: string | null, createdAt?: string): Freshness {
  const base = lastVerifiedAt || createdAt
  if (!base) return { level: 'fresh', label: '', color: 'var(--ink-4)', bg: 'transparent', days: 0 }
  const days = Math.floor((Date.now() - new Date(base).getTime()) / 86400000)
  if (days <= 7) return { level: 'fresh', label: '최근 확인', color: '#12B76A', bg: 'rgba(18,183,106,0.12)', days }
  if (days <= 30) return { level: 'aging', label: `${days}일 전 확인`, color: 'var(--ink-3)', bg: 'var(--surface-2)', days }
  return { level: 'stale', label: '오래된 정보', color: 'var(--ink-4)', bg: 'var(--surface-2)', days }
}
