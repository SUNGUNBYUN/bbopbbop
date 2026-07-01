'use client'
import { useState, useRef } from 'react'

/** 가로 스와이프 이미지 갤러리 (도트 인디케이터 포함) */
export function ImageGallery({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  if (images.length === 0) return null
  if (images.length === 1) {
    return (
      <img src={images[0]} alt="사진" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', background: 'var(--surface-2)' }} />
    )
  }

  function onScroll() {
    if (!scrollRef.current) return
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth)
    setCurrent(idx)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="no-scrollbar"
        style={{
          display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
          aspectRatio: '4/3', background: 'var(--surface-2)',
        }}
      >
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`사진 ${i + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', flexShrink: 0, scrollSnapAlign: 'start' }}
          />
        ))}
      </div>

      {/* 카운터 */}
      <div style={{
        position: 'absolute', top: '12px', right: '12px', background: 'rgba(26,21,35,0.6)',
        color: '#fff', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--r-full)',
      }}>{current + 1} / {images.length}</div>

      {/* 도트 */}
      <div style={{
        position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '5px',
      }}>
        {images.map((_, i) => (
          <div key={i} style={{
            width: current === i ? '18px' : '6px', height: '6px', borderRadius: 'var(--r-full)',
            background: current === i ? '#fff' : 'rgba(255,255,255,0.5)',
            transition: 'width 0.2s ease',
          }} />
        ))}
      </div>
    </div>
  )
}
