'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  onClose: () => void
  onSuccess: () => void
}

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

    setLoading(true)
    setError('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError('이메일 또는 비밀번호가 틀렸어요'); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { nickname } }
      })
      if (error) { setError('가입 중 오류가 발생했어요'); setLoading(false); return }
    }

    setLoading(false)
    onSuccess()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', maxWidth: '430px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
            {mode === 'login' ? '로그인' : '회원가입'}
          </h2>
          <button onClick={onClose} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', backgroundColor: '#f5f5f5', borderRadius: '12px', padding: '4px' }}>
          <button
            onClick={() => { setMode('login'); setError('') }}
            style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600', backgroundColor: mode === 'login' ? '#fff' : 'transparent', color: mode === 'login' ? '#FF6B6B' : '#888', boxShadow: mode === 'login' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}
          >로그인</button>
          <button
            onClick={() => { setMode('signup'); setError('') }}
            style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600', backgroundColor: mode === 'signup' ? '#fff' : 'transparent', color: mode === 'signup' ? '#FF6B6B' : '#888', boxShadow: mode === 'signup' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}
          >회원가입</button>
        </div>

        {/* 닉네임 — 회원가입만 */}
        {mode === 'signup' && (
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>닉네임 <span style={{ color: '#FF6B6B' }}>*</span></label>
            <input
              type="text"
              placeholder="예) 뽑기고수123"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {/* 이메일 */}
        <div>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>이메일 <span style={{ color: '#FF6B6B' }}>*</span></label>
          <input
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box' }}
          />
        </div>

        {/* 비밀번호 */}
        <div>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#444', display: 'block', marginBottom: '6px' }}>비밀번호 <span style={{ color: '#FF6B6B' }}>*</span></label>
          <input
            type="password"
            placeholder="6자 이상"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #f0f0f0', fontSize: '14px', outline: 'none', backgroundColor: '#fafafa', boxSizing: 'border-box' }}
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <p style={{ fontSize: '13px', color: '#FF6B6B', margin: 0 }}>⚠ {error}</p>
        )}

        {/* 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: '#FF6B6B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: '700', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
        </button>

      </div>
    </div>
  )
}