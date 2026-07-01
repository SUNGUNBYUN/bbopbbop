'use client'
import { useState } from 'react'
import { ClawMark } from './Logo'
import { Button } from './ui'

type Props = { onDone: () => void }

const SLIDES = [
  {
    emoji: '📍',
    color: 'var(--coral)',
    bg: 'var(--coral-soft)',
    title: '어디서 뭘 뽑을 수 있나요?',
    desc: '내 주변 인형뽑기 업체를 지도로 확인하고,\n뭐가 있는지 제보를 남겨보세요.',
  },
  {
    emoji: '📸',
    color: 'var(--mint)',
    bg: 'var(--mint-soft)',
    title: '오늘 뭐 뽑았어요?',
    desc: '어렵게 뽑아낸 인형을 자랑하고\n다른 덕후들의 전리품도 구경해보세요.',
  },
  {
    emoji: '🛍️',
    color: 'var(--butter)',
    bg: 'var(--butter-soft)',
    title: '사고팔고 나누고',
    desc: '원하는 인형은 찾고,\n중복된 건 나눠요. 뽑기 덕후들의 마켓.',
  },
]

export function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const slide = SLIDES[step]
  const isLast = step === SLIDES.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'var(--surface)',
      maxWidth: 'var(--app-max)', margin: '0 auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Skip */}
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onDone} style={{ fontSize: '13.5px', color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>건너뛰기</button>
      </div>

      {/* 슬라이드 영역 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 32px', textAlign: 'center', gap: '28px' }}>

        {/* 아이콘 */}
        <div style={{
          width: '140px', height: '140px', borderRadius: '40px',
          background: slide.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '62px',
          animation: 'popIn 0.4s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: `0 16px 40px ${slide.color}22`,
        }}
          key={step}
        >{slide.emoji}</div>

        {/* 텍스트 */}
        <div key={`text-${step}`} className="animate-fade">
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ink)', margin: '0 0 14px', lineHeight: 1.3 }}>{slide.title}</h2>
          <p style={{ fontSize: '15.5px', color: 'var(--ink-3)', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{slide.desc}</p>
        </div>

        {/* 도트 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {SLIDES.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{
              height: '8px',
              width: step === i ? '24px' : '8px',
              borderRadius: 'var(--r-full)',
              background: step === i ? slide.color : 'var(--surface-3)',
              transition: 'width 0.25s ease, background 0.25s ease',
              cursor: 'pointer',
            }} />
          ))}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div style={{ padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isLast ? (
          <>
            <Button full size="lg" onClick={onDone}>🧸 시작하기</Button>
            <p style={{ fontSize: '12px', color: 'var(--ink-4)', textAlign: 'center', margin: 0 }}>
              가입 없이도 제보를 구경할 수 있어요
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} style={{ flex: 1, padding: '15px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>이전</button>
            )}
            <button
              onClick={() => setStep(step + 1)}
              className="pressable"
              style={{ flex: 2, padding: '15px', borderRadius: 'var(--r-md)', background: slide.color, color: step === 1 ? 'var(--ink)' : '#fff', fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: `0 8px 24px ${slide.color}44` }}
            >다음 →</button>
          </div>
        )}
      </div>
    </div>
  )
}
