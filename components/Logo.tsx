'use client'

/** 뽑뽑 집게(claw) 로고 — 앱의 시그니처 마크 */
export function ClawMark({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      style={animated ? { animation: 'clawDrop 2.4s ease-in-out infinite' } : undefined}>
      {/* 상단 바 */}
      <rect x="6" y="4" width="20" height="3.2" rx="1.6" fill="var(--coral)" />
      {/* 케이블 */}
      <rect x="14.6" y="6" width="2.8" height="6" rx="1.4" fill="var(--ink-3)" />
      {/* 집게 몸통 */}
      <path d="M11 12 h10 a2 2 0 0 1 2 2 v1.5 a7 7 0 0 1 -14 0 V14 a2 2 0 0 1 2 -2 z" fill="var(--coral)" />
      {/* 집게 발 (왼) */}
      <path d="M10 15 C7 19, 6.5 23, 8.5 26 C9.5 24, 9.5 21, 11.5 18.5 Z" fill="var(--coral-dark)" />
      {/* 집게 발 (오) */}
      <path d="M22 15 C25 19, 25.5 23, 23.5 26 C22.5 24, 22.5 21, 20.5 18.5 Z" fill="var(--coral-dark)" />
      {/* 집게 발 (중앙) */}
      <path d="M16 17 C15 21, 15 25, 16 28 C17 25, 17 21, 16 17 Z" fill="var(--coral-dark)" />
    </svg>
  )
}

/** 로고 + 워드마크 */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      <ClawMark size={size} animated />
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: `${size * 0.82}px`,
        fontWeight: 800,
        color: 'var(--coral)',
        letterSpacing: '-0.5px',
      }}>
        뽑뽑
      </span>
    </div>
  )
}
