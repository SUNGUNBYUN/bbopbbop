'use client'
import { ReactNode, CSSProperties, ButtonHTMLAttributes } from 'react'

/* ============================================
   뽑뽑 UI 컴포넌트 라이브러리
   ============================================ */

/* --- Button --- */
type BtnVariant = 'primary' | 'soft' | 'ghost' | 'outline' | 'mint'
type BtnSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  full?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', full, children, style, ...rest }: ButtonProps) {
  const variants: Record<BtnVariant, CSSProperties> = {
    primary: { background: 'var(--coral)', color: '#fff', border: 'none', boxShadow: 'var(--shadow-coral)' },
    soft: { background: 'var(--coral-soft)', color: 'var(--coral)', border: 'none' },
    ghost: { background: 'transparent', color: 'var(--ink-2)', border: 'none' },
    outline: { background: '#fff', color: 'var(--ink)', border: '1.5px solid var(--line-2)' },
    mint: { background: 'var(--mint)', color: '#fff', border: 'none', boxShadow: '0 8px 24px rgba(61,214,196,0.3)' },
  }
  const sizes: Record<BtnSize, CSSProperties> = {
    sm: { padding: '8px 14px', fontSize: '13px', borderRadius: 'var(--r-full)' },
    md: { padding: '12px 18px', fontSize: '14px', borderRadius: 'var(--r-md)' },
    lg: { padding: '15px 20px', fontSize: '15px', borderRadius: 'var(--r-md)' },
  }
  return (
    <button
      className="pressable"
      style={{
        ...variants[variant],
        ...sizes[size],
        width: full ? '100%' : 'auto',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        transition: 'transform 0.12s ease, opacity 0.15s ease',
        opacity: rest.disabled ? 0.5 : 1,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

/* --- Card (유리 진열장) --- */
export function Card({ children, onClick, style, className }: {
  children: ReactNode; onClick?: () => void; style?: CSSProperties; className?: string
}) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.16s ease, box-shadow 0.16s ease',
        ...style,
      }}
      onMouseDown={onClick ? (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.985)' } : undefined}
      onMouseUp={onClick ? (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' } : undefined}
      onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' } : undefined}
    >
      {children}
    </div>
  )
}

/* --- Avatar --- */
export function Avatar({ name, size = 36, color = 'var(--coral)' }: {
  name: string | null; size?: number; color?: string
}) {
  const letter = (name ?? '익')[0]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800, flexShrink: 0,
      fontFamily: 'var(--font-display)',
    }}>
      {letter}
    </div>
  )
}

/* --- Badge --- */
export function Badge({ children, color = 'var(--coral)', bg = 'var(--coral-soft)', style }: {
  children: ReactNode; color?: string; bg?: string; style?: CSSProperties
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      background: bg, color, fontSize: '11px', fontWeight: 700,
      padding: '3px 9px', borderRadius: 'var(--r-full)',
      ...style,
    }}>
      {children}
    </span>
  )
}

/* --- StatChip (조회/좋아요/댓글) --- */
export function Stat({ icon, value }: { icon: string; value: number | string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: 'var(--ink-3)' }}>
      <span style={{ fontSize: '13px' }}>{icon}</span>
      {value}
    </span>
  )
}

/* --- Input --- */
export function Input({ error, style, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      style={{
        width: '100%', padding: '13px 15px', borderRadius: 'var(--r-md)',
        border: `1.5px solid ${error ? 'var(--danger)' : 'var(--line)'}`,
        fontSize: '15px', outline: 'none', background: 'var(--surface)',
        color: 'var(--ink)', boxSizing: 'border-box',
        transition: 'border-color 0.15s ease',
        ...style,
      }}
      onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = 'var(--coral)' }}
      onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = 'var(--line)' }}
      {...rest}
    />
  )
}

/* --- Field (label + input wrapper) --- */
export function Field({ label, required, optional, error, children }: {
  label: string; required?: boolean; optional?: boolean; error?: string; children: ReactNode
}) {
  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: '7px' }}>
        {label}
        {required && <span style={{ color: 'var(--coral)', marginLeft: '3px' }}>*</span>}
        {optional && <span style={{ fontSize: '11px', color: 'var(--ink-4)', fontWeight: 500, marginLeft: '5px' }}>선택</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: '12px', color: 'var(--danger)', margin: '7px 0 0' }}>⚠ {error}</p>}
    </div>
  )
}

/* --- EmptyState (빈 화면) --- */
export function EmptyState({ emoji, title, desc, action }: {
  emoji: string; title: string; desc?: string; action?: ReactNode
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '56px 24px', textAlign: 'center', gap: '4px',
    }}>
      <div style={{ fontSize: '52px', marginBottom: '8px', animation: 'floaty 3s ease-in-out infinite' }}>{emoji}</div>
      <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{title}</p>
      {desc && <p style={{ fontSize: '13.5px', color: 'var(--ink-3)', margin: '2px 0 0', lineHeight: 1.5 }}>{desc}</p>}
      {action && <div style={{ marginTop: '18px' }}>{action}</div>}
    </div>
  )
}

/* --- Header (화면 상단 바) --- */
export function Header({ left, title, right }: {
  left?: ReactNode; title?: ReactNode; right?: ReactNode
}) {
  return (
    <header style={{
      height: 'var(--header-h)', padding: '0 12px',
      borderBottom: '1px solid var(--line)',
      display: 'flex', alignItems: 'center', gap: '4px',
      background: 'var(--surface)', flexShrink: 0,
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      <div style={{ minWidth: '40px', display: 'flex', alignItems: 'center' }}>{left}</div>
      <div style={{ flex: 1, textAlign: 'center', fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
      <div style={{ minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>{right}</div>
    </header>
  )
}

/* --- IconButton --- */
export function IconButton({ children, onClick, badge, ...rest }: {
  children: ReactNode; onClick?: () => void; badge?: number
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      className="pressable"
      style={{
        width: '40px', height: '40px', borderRadius: '50%',
        background: 'transparent', border: 'none', cursor: 'pointer',
        fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', color: 'var(--ink-2)',
      }}
      {...rest}
    >
      {children}
      {badge != null && badge > 0 && (
        <span style={{
          position: 'absolute', top: '4px', right: '4px',
          minWidth: '17px', height: '17px', padding: '0 4px',
          background: 'var(--coral)', color: '#fff', borderRadius: 'var(--r-full)',
          fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--surface)',
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  )
}

/* --- BackButton --- */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton onClick={onClick} aria-label="뒤로">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IconButton>
  )
}

/* --- Sheet (하단 시트) --- */
export function Sheet({ children, onClose, title }: {
  children: ReactNode; onClose: () => void; title?: string
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26,21,35,0.5)',
        zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up"
        style={{
          width: '100%', maxWidth: 'var(--app-max)', background: 'var(--surface)',
          borderRadius: 'var(--r-xl) var(--r-xl) 0 0', padding: '8px 20px 28px',
          maxHeight: '85dvh', overflowY: 'auto',
        }}
      >
        <div style={{ width: '40px', height: '4px', background: 'var(--surface-3)', borderRadius: 'var(--r-full)', margin: '0 auto 16px' }} />
        {title && <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 18px', color: 'var(--ink)' }}>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

/* --- Toast --- */
export function Toast({ message, emoji }: { message: string; emoji?: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: 'calc(var(--nav-h) + 20px)', left: '50%',
      transform: 'translateX(-50%)', zIndex: 300,
      background: 'var(--ink)', color: '#fff', padding: '12px 20px',
      borderRadius: 'var(--r-full)', fontSize: '14px', fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: '8px',
      boxShadow: 'var(--shadow-lg)', animation: 'popIn 0.3s ease',
      maxWidth: '90%',
    }}>
      {emoji && <span style={{ fontSize: '16px' }}>{emoji}</span>}
      {message}
    </div>
  )
}

/* --- Spinner --- */
export function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 0' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        border: '3px solid var(--surface-3)', borderTopColor: 'var(--coral)',
        animation: 'spin 0.7s linear infinite',
      }} />
      {label && <p style={{ fontSize: '13px', color: 'var(--ink-3)', margin: 0 }}>{label}</p>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}


/** 등급 뱃지 (닉네임 옆 작은 표시) */
export function LevelBadge({ emoji, name, color, bg, size = 'sm' }: {
  emoji: string; name: string; color: string; bg: string; size?: 'sm' | 'md'
}) {
  const isSm = size === 'sm'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: isSm ? '10.5px' : '12px', fontWeight: 800,
      color, background: bg,
      padding: isSm ? '2px 6px' : '3px 9px',
      borderRadius: 'var(--r-full)', flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      <span>{emoji}</span>{name}
    </span>
  )
}
