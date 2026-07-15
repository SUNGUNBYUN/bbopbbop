'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ClawMark } from '@/components/Logo'
import { Button, Input, Field } from '@/components/ui'

type Props = { onClose: () => void; onSuccess: () => void }
type Step = 'input' | 'verify'
type Mode = 'login' | 'signup'

export default function Auth({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('input')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [timer, setTimer] = useState(0)

  function startTimer() {
    setTimer(600)
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function formatTimer(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }

  // 인증번호(OTP) 발송 — Supabase가 이메일 전송
  async function handleSendCode() {
    if (!isValidEmail(email)) { setError('올바른 이메일을 입력해주세요'); return }
    if (mode === 'signup' && !nickname.trim()) { setError('닉네임을 입력해주세요'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // 가입이면 닉네임 저장, 회원가입만 새 계정 생성 허용
        shouldCreateUser: mode === 'signup',
        data: mode === 'signup' ? { nickname: nickname.trim() } : undefined,
      },
    })
    setLoading(false)
    if (error) {
      // 로그인인데 계정이 없을 때 등
      if (error.message.includes('Signups not allowed') || error.message.toLowerCase().includes('user not found')) {
        setError('가입되지 않은 이메일이에요. 회원가입을 먼저 해주세요')
      } else {
        setError('발송에 실패했어요. 잠시 후 다시 시도해주세요')
      }
      return
    }
    setStep('verify')
    startTimer()
  }

  // 인증번호 확인 → 로그인/가입 완료
  async function handleVerify() {
    if (code.length !== 6) { setError('6자리 인증번호를 입력해주세요'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setLoading(false)
    if (error) { setError('인증번호가 틀렸거나 만료됐어요'); return }
    onSuccess()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,35,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slide-up" style={{ width: '100%', maxWidth: 'var(--app-max)', background: 'var(--surface)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0', padding: '10px 20px 36px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div style={{ width: '40px', height: '4px', background: 'var(--surface-3)', borderRadius: 'var(--r-full)', margin: '0 auto' }} />

        {/* 헤더 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', marginBottom: '8px' }}><ClawMark size={40} animated /></div>
          <h2 style={{ fontSize: '19px', fontWeight: 800, margin: '0 0 3px', color: 'var(--ink)' }}>
            {step === 'verify' ? '인증번호를 입력해주세요'
              : mode === 'login' ? '다시 만나서 반가워요'
              : '뽑뽑에 오신 걸 환영해요'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-3)', margin: 0 }}>
            {step === 'verify' ? `${email}로 발송된 6자리 코드`
              : mode === 'login' ? '이메일로 인증번호를 보내드려요'
              : '이메일로 인증번호를 보내드려요'}
          </p>
        </div>

        {/* 탭 */}
        {step === 'input' && (
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '4px' }}>
            {(['login', 'signup'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }} style={{ flex: 1, padding: '9px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, background: mode === m ? 'var(--surface)' : 'transparent', color: mode === m ? 'var(--coral)' : 'var(--ink-3)', boxShadow: mode === m ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s ease' }}>
                {m === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>
        )}

        {/* 입력 단계 */}
        {step === 'input' && (
          <>
            {mode === 'signup' && (
              <Field label="닉네임" required>
                <Input placeholder="예) 뽑기고수123" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              </Field>
            )}
            <Field label="이메일" required>
              <Input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendCode()} />
            </Field>
          </>
        )}

        {/* 인증번호 단계 */}
        {step === 'verify' && (
          <div>
            <Field label="인증번호" required>
              <Input
                placeholder="000000"
                value={code}
                maxLength={6}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                style={{ fontSize: '22px', letterSpacing: '8px', textAlign: 'center', fontWeight: 700 }}
              />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <span style={{ fontSize: '12.5px', color: timer < 60 ? 'var(--danger)' : 'var(--ink-4)' }}>
                {timer > 0 ? `${formatTimer(timer)} 후 만료` : '만료됐어요'}
              </span>
              <button onClick={() => { setStep('input'); setCode(''); setError('') }} style={{ fontSize: '12.5px', color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                다시 받기
              </button>
            </div>
          </div>
        )}

        {error && <p style={{ fontSize: '13px', color: 'var(--danger)', margin: 0, textAlign: 'center' }}>⚠ {error}</p>}

        {step === 'input' && (
          <Button full size="lg" onClick={handleSendCode} disabled={loading}>
            {loading ? '발송 중...' : '인증번호 받기 →'}
          </Button>
        )}
        {step === 'verify' && (
          <Button full size="lg" onClick={handleVerify} disabled={loading || code.length !== 6}>
            {loading ? '확인 중...' : mode === 'signup' ? '🎉 가입 완료' : '로그인'}
          </Button>
        )}
      </div>
    </div>
  )
}
