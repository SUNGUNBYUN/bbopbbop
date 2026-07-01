'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ClawMark } from '@/components/Logo'
import { Button, Input, Field } from '@/components/ui'

type Props = { onClose: () => void; onSuccess: () => void }

export default function Auth({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요'); return }
    if (mode === 'signup' && !nickname) { setError('닉네임을 입력해주세요'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 해요'); return }
    setLoading(true); setError('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError('이메일 또는 비밀번호가 틀렸어요'); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { nickname } } })
      if (error) { setError('가입 중 오류가 발생했어요'); setLoading(false); return }
    }
    setLoading(false)
    onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,35,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slide-up" style={{ width: '100%', maxWidth: 'var(--app-max)', background: 'var(--surface)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0', padding: '10px 20px 32px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ width: '40px', height: '4px', background: 'var(--surface-3)', borderRadius: 'var(--r-full)', margin: '0 auto' }} />

        {/* 로고 헤더 */}
        <div style={{ textAlign: 'center', paddingTop: '8px' }}>
          <div style={{ display: 'inline-flex', marginBottom: '10px' }}><ClawMark size={44} animated /></div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px', color: 'var(--ink)' }}>
            {mode === 'login' ? '다시 만나서 반가워요' : '뽑뽑에 오신 걸 환영해요'}
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--ink-3)', margin: 0 }}>
            {mode === 'login' ? '로그인하고 제보를 남겨보세요' : '가입하고 뽑기 덕후들과 함께해요'}
          </p>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '4px' }}>
          {(['login', 'signup'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }} style={{ flex: 1, padding: '9px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, background: mode === m ? 'var(--surface)' : 'transparent', color: mode === m ? 'var(--coral)' : 'var(--ink-3)', boxShadow: mode === m ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s ease' }}>
              {m === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {mode === 'signup' && (
          <Field label="닉네임" required>
            <Input placeholder="예) 뽑기고수123" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </Field>
        )}
        <Field label="이메일" required>
          <Input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="비밀번호" required>
          <Input type="password" placeholder="6자 이상" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
        </Field>

        {error && <p style={{ fontSize: '13px', color: 'var(--danger)', margin: 0, textAlign: 'center' }}>⚠ {error}</p>}

        <Button full size="lg" onClick={handleSubmit} disabled={loading}>
          {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
        </Button>
      </div>
    </div>
  )
}
