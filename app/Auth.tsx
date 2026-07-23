'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ClawMark } from '@/components/Logo'
import { Button, Input, Field } from '@/components/ui'

type Props = { onClose: () => void; onSuccess: () => void }
type Mode = 'login' | 'signup'
// 가입 단계: 입력 → 인증번호 → 비밀번호 설정
type Step = 'input' | 'verify' | 'password'

export default function Auth({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('input')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [timer, setTimer] = useState(0)
  // 최소 사용자 정보 (선택) — 가입 시 함께 수집
  const [gender, setGender] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [region, setRegion] = useState('')

  function startTimer() {
    setTimer(600)
    const interval = setInterval(() => {
      setTimer(prev => { if (prev <= 1) { clearInterval(interval); return 0 } return prev - 1 })
    }, 1000)
  }
  function formatTimer(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  }

  // 로그인: 이메일 + 비밀번호
  async function handleLogin() {
    if (!isValidEmail(email)) { setError('올바른 이메일을 입력해주세요'); return }
    if (!password) { setError('비밀번호를 입력해주세요'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError('이메일 또는 비밀번호가 틀렸어요'); return }
    onSuccess()
  }

  // 가입 1단계: 인증번호(OTP) 발송
  async function handleSendCode() {
    if (!isValidEmail(email)) { setError('올바른 이메일을 입력해주세요'); return }
    if (!nickname.trim()) { setError('닉네임을 입력해주세요'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { nickname: nickname.trim() } },
    })
    setLoading(false)
    if (error) {
      if (error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('registered')) {
        setError('이미 가입된 이메일이에요. 로그인해주세요')
      } else {
        setError('발송에 실패했어요. 잠시 후 다시 시도해주세요')
      }
      return
    }
    setStep('verify')
    startTimer()
  }

  // 가입 2단계: 인증번호 확인 → 로그인 상태로 진입
  async function handleVerify() {
    if (code.length !== 8) { setError('8자리 인증번호를 입력해주세요'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    setLoading(false)
    if (error) { setError('인증번호가 틀렸거나 만료됐어요'); return }
    setStep('password')  // 인증 성공 → 비밀번호 설정 단계
  }

  // 가입 3단계: 비밀번호 설정 → 가입 완료
  async function handleSetPassword() {
    if (password.length < 6) { setError('비밀번호는 6자 이상이에요'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError('비밀번호 설정에 실패했어요'); return }
    // 가입 시 입력한 최소 정보 저장 (선택 — 실패해도 가입은 완료)
    if (gender || ageGroup || region) {
      try { await supabase.rpc('update_my_info', { p_gender: gender, p_age_group: ageGroup, p_region: region }) } catch { /* 가입은 그대로 완료 */ }
    }
    onSuccess()  // 이미 로그인 상태
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,35,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-slide-up" style={{ width: '100%', maxWidth: 'var(--app-max)', background: 'var(--surface)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0', padding: '10px 20px 36px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div style={{ width: '40px', height: '4px', background: 'var(--surface-3)', borderRadius: 'var(--r-full)', margin: '0 auto' }} />

        {/* 가입 단계바 */}
        {mode === 'signup' && (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            {(['input', 'verify', 'password'] as Step[]).map((s, i) => {
              const active = (step === 'input' && i === 0) || (step === 'verify' && i <= 1) || step === 'password'
              return <div key={i} style={{ height: '4px', width: active ? '24px' : '8px', borderRadius: '2px', background: active ? 'var(--coral)' : 'var(--surface-3)', transition: 'all 0.2s ease' }} />
            })}
          </div>
        )}

        {/* 헤더 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', marginBottom: '8px' }}><ClawMark size={40} animated /></div>
          <h2 style={{ fontSize: '19px', fontWeight: 800, margin: '0 0 3px', color: 'var(--ink)' }}>
            {mode === 'login' ? '다시 만나서 반가워요'
              : step === 'input' ? '뽑뽑에 오신 걸 환영해요'
              : step === 'verify' ? '인증번호를 입력해주세요'
              : '비밀번호를 설정해주세요'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-3)', margin: 0 }}>
            {mode === 'login' ? '이메일과 비밀번호로 로그인'
              : step === 'input' ? '이메일로 인증번호를 보내드려요'
              : step === 'verify' ? `${email}로 발송된 8자리 코드`
              : '다음부터 이 비밀번호로 로그인해요'}
          </p>
        </div>

        {/* 탭 */}
        {step === 'input' && (
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '4px' }}>
            {(['login', 'signup'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setStep('input') }} style={{ flex: 1, padding: '9px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, background: mode === m ? 'var(--surface)' : 'transparent', color: mode === m ? 'var(--coral)' : 'var(--ink-3)', boxShadow: mode === m ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s ease' }}>
                {m === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>
        )}

        {/* 로그인 */}
        {mode === 'login' && (
          <>
            <Field label="이메일" required>
              <Input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="비밀번호" required>
              <Input type="password" placeholder="비밀번호 입력" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
            </Field>
          </>
        )}

        {/* 가입 1단계 */}
        {mode === 'signup' && step === 'input' && (
          <>
            <Field label="닉네임" required>
              <Input placeholder="예) 뽑기고수123" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </Field>
            <Field label="이메일" required>
              <Input type="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendCode()} />
            </Field>
            <Field label="내 정보 (선택)">
              <div style={{ display: 'flex', gap: '7px' }}>
                {([
                  [gender, setGender, '성별', [['male', '남성'], ['female', '여성'], ['other', '기타']]],
                  [ageGroup, setAgeGroup, '연령대', [['10s', '10대'], ['20s', '20대'], ['30s', '30대'], ['40s+', '40대+']]],
                  [region, setRegion, '지역', [['서울', '서울'], ['경기·인천', '경기·인천'], ['부산·경남', '부산·경남'], ['대구·경북', '대구·경북'], ['대전·충청', '대전·충청'], ['광주·전라', '광주·전라'], ['기타', '기타']]],
                ] as const).map(([val, setter, label, opts], i) => (
                  <select
                    key={i}
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: '11px 8px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', background: 'var(--surface)', fontSize: '13px', color: val ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'inherit', cursor: 'pointer' }}
                  >
                    <option value="">{label}</option>
                    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ))}
              </div>
            </Field>
          </>
        )}

        {/* 가입 2단계 — 인증번호 */}
        {mode === 'signup' && step === 'verify' && (
          <div>
            <Field label="인증번호" required>
              <Input
                placeholder="8자리 숫자"
                value={code}
                maxLength={8}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                style={{ fontSize: '20px', letterSpacing: '6px', textAlign: 'center', fontWeight: 700 }}
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

        {/* 가입 3단계 — 비밀번호 설정 */}
        {mode === 'signup' && step === 'password' && (
          <Field label="비밀번호" required>
            <Input type="password" placeholder="6자 이상 입력" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()} />
          </Field>
        )}

        {error && <p style={{ fontSize: '13px', color: 'var(--danger)', margin: 0, textAlign: 'center' }}>⚠ {error}</p>}

        {mode === 'login' && (
          <Button full size="lg" onClick={handleLogin} disabled={loading}>{loading ? '로그인 중...' : '로그인'}</Button>
        )}
        {mode === 'signup' && step === 'input' && (
          <Button full size="lg" onClick={handleSendCode} disabled={loading}>{loading ? '발송 중...' : '인증번호 받기 →'}</Button>
        )}
        {mode === 'signup' && step === 'verify' && (
          <Button full size="lg" onClick={handleVerify} disabled={loading || code.length !== 8}>{loading ? '확인 중...' : '확인 →'}</Button>
        )}
        {mode === 'signup' && step === 'password' && (
          <Button full size="lg" onClick={handleSetPassword} disabled={loading || password.length < 6}>{loading ? '가입 중...' : '🎉 가입 완료'}</Button>
        )}
      </div>
    </div>
  )
}
