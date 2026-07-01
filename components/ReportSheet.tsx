'use client'
import { useState } from 'react'
import { User } from '@/lib/types'
import { REPORT_REASONS, reportContent, blockUser } from '@/lib/social'
import { Sheet, Button } from './ui'

type Props = {
  user: User | null
  targetType: 'post' | 'market' | 'feed' | 'comment' | 'user'
  targetId: string
  targetUserId?: string | null
  targetNickname?: string | null
  onClose: () => void
  onDone: (msg: string) => void
  onRequireAuth: () => void
}

export function ReportSheet({ user, targetType, targetId, targetUserId, targetNickname, onClose, onDone, onRequireAuth }: Props) {
  const [mode, setMode] = useState<'menu' | 'report'>('menu')
  const [reason, setReason] = useState<string>('')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submitReport() {
    if (!user) { onRequireAuth(); return }
    if (!reason) return
    setSubmitting(true)
    await reportContent({ reporterId: user.id, targetType, targetId, reason, detail: detail.trim() || undefined })
    setSubmitting(false)
    onDone('신고가 접수되었어요. 검토 후 조치할게요')
  }

  async function handleBlock() {
    if (!user) { onRequireAuth(); return }
    if (!targetUserId) return
    if (!confirm(`${targetNickname ?? '이 사용자'}님을 차단할까요?\n차단하면 서로의 글과 채팅이 보이지 않아요.`)) return
    await blockUser(user.id, targetUserId)
    onDone('차단했어요')
  }

  return (
    <Sheet onClose={onClose} title={mode === 'menu' ? undefined : '신고 사유'}>
      {mode === 'menu' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <MenuItem emoji="🚨" label="신고하기" onClick={() => setMode('report')} />
          {targetUserId && user?.id !== targetUserId && (
            <MenuItem emoji="🚫" label={`${targetNickname ?? '사용자'} 차단하기`} danger onClick={handleBlock} />
          )}
          <MenuItem emoji="✕" label="취소" muted onClick={onClose} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {REPORT_REASONS.map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                border: `1.5px solid ${reason === r ? 'var(--coral)' : 'var(--line)'}`,
                background: reason === r ? 'var(--coral-soft)' : 'var(--surface)',
                fontSize: '14.5px', fontWeight: 600,
                color: reason === r ? 'var(--coral)' : 'var(--ink-2)',
              }}
            >
              {r}
              {reason === r && <span>✓</span>}
            </button>
          ))}
          {reason === '기타' && (
            <textarea
              placeholder="상세 사유를 적어주세요"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              style={{ width: '100%', padding: '13px 15px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', fontSize: '14px', outline: 'none', minHeight: '80px', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          )}
          <Button full size="lg" onClick={submitReport} disabled={!reason || submitting} style={{ marginTop: '8px' }}>
            {submitting ? '접수 중...' : '신고 접수'}
          </Button>
        </div>
      )}
    </Sheet>
  )
}

function MenuItem({ emoji, label, onClick, danger, muted }: {
  emoji: string; label: string; onClick: () => void; danger?: boolean; muted?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="pressable"
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '15px 12px', borderRadius: 'var(--r-md)', border: 'none',
        background: 'transparent', cursor: 'pointer', fontSize: '15px', fontWeight: 600,
        color: danger ? 'var(--danger)' : muted ? 'var(--ink-4)' : 'var(--ink)',
        textAlign: 'left', width: '100%',
      }}
    >
      <span style={{ fontSize: '18px' }}>{emoji}</span>
      {label}
    </button>
  )
}
