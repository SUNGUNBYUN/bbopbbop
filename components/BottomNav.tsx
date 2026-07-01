'use client'

type Tab = { icon: string; activeIcon: string; label: string }

const TABS: Tab[] = [
  { icon: '🔍', activeIcon: '🔍', label: '제보' },
  { icon: '🗺️', activeIcon: '🗺️', label: '지도' },
  { icon: '🛍️', activeIcon: '🛍️', label: '마켓' },
  { icon: '📸', activeIcon: '📸', label: '피드' },
]

export function BottomNav({ active, onChange }: { active: number; onChange: (i: number) => void }) {
  return (
    <nav style={{
      height: 'var(--nav-h)', borderTop: '1px solid var(--line)',
      display: 'flex', background: 'var(--surface)', flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map((tab, i) => {
        const isActive = active === i
        return (
          <button
            key={tab.label}
            onClick={() => onChange(i)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '3px', background: 'none', border: 'none',
              cursor: 'pointer', position: 'relative',
            }}
          >
            <span style={{
              fontSize: '21px',
              filter: isActive ? 'none' : 'grayscale(0.5) opacity(0.55)',
              transform: isActive ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 0.18s ease, filter 0.18s ease',
            }}>{isActive ? tab.activeIcon : tab.icon}</span>
            <span style={{
              fontSize: '10.5px', fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--coral)' : 'var(--ink-4)',
              transition: 'color 0.18s ease',
            }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

/** 플로팅 액션 버튼 */
export function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="pressable"
      aria-label="새 글 작성"
      style={{
        position: 'absolute', bottom: 'calc(var(--nav-h) + 16px)', right: '18px',
        width: '56px', height: '56px', borderRadius: '50%',
        background: 'var(--coral)', color: '#fff', fontSize: '28px', fontWeight: 300,
        border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-coral)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 40, lineHeight: 1,
      }}
    >+</button>
  )
}
