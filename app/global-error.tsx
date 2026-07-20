'use client'
import { useEffect } from 'react'

/** 최상위(레이아웃 포함) 오류. 새 배포로 파일이 바뀐 경우 자동 새로고침. */
export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const msg = `${error?.name ?? ''} ${error?.message ?? ''}`
    if (/ChunkLoadError|Loading chunk|dynamically imported module|module script failed/i.test(msg)) {
      const KEY = 'bbop_reloaded_at'
      const last = Number(sessionStorage.getItem(KEY) ?? 0)
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()))
        window.location.reload()
      }
    }
  }, [error])

  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>
        <div style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '32px',
          background: '#FBFAF8', textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <span style={{ fontSize: '52px' }}>🧸</span>
          <p style={{ fontSize: '17px', fontWeight: 800, color: '#1A1523', margin: '16px 0 0' }}>
            앱을 불러오지 못했어요
          </p>
          <p style={{ fontSize: '14px', color: '#6B6577', margin: '8px 0 22px', lineHeight: 1.6 }}>
            잠시 후 다시 시도해주세요.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '14px 28px', borderRadius: '14px', background: '#FF5A5F', color: '#fff',
              fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer',
            }}
          >새로고침</button>
        </div>
      </body>
    </html>
  )
}
