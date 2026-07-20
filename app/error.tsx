'use client'
import { useEffect, useState } from 'react'

/**
 * 화면이 깨졌을 때 보여주는 복구 화면.
 * 새 버전이 배포되면 예전 JS 파일이 사라져서 앱이 멈추는 경우가 있는데,
 * 그때는 자동으로 새로고침해서 최신 버전을 받아와요.
 */
export default function Error({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    const msg = `${error?.name ?? ''} ${error?.message ?? ''}`
    const isStaleBuild = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|module script failed|Unexpected token '<'/i.test(msg)

    if (isStaleBuild) {
      // 같은 오류로 무한 새로고침 되는 걸 막기 위해 한 번만 시도
      const KEY = 'bbop_reloaded_at'
      const last = Number(sessionStorage.getItem(KEY) ?? 0)
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()))
        setReloading(true)
        window.location.reload()
      }
    }
  }, [error])

  if (reloading) {
    return (
      <div style={wrap}>
        <span style={{ fontSize: '44px' }}>🔄</span>
        <p style={title}>최신 버전을 불러오는 중…</p>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <span style={{ fontSize: '52px' }}>🧸</span>
      <p style={title}>화면을 불러오지 못했어요</p>
      <p style={desc}>잠시 문제가 생겼어요.<br />아래 버튼을 눌러 다시 시도해주세요.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '260px', marginTop: '22px' }}>
        <button onClick={() => reset()} style={primaryBtn}>다시 시도</button>
        <button onClick={() => window.location.reload()} style={softBtn}>새로고침</button>
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = {
  minHeight: '100dvh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', padding: '32px',
  background: '#FBFAF8', textAlign: 'center',
}
const title: React.CSSProperties = {
  fontSize: '17px', fontWeight: 800, color: '#1A1523', margin: '16px 0 0',
}
const desc: React.CSSProperties = {
  fontSize: '14px', color: '#6B6577', margin: '8px 0 0', lineHeight: 1.6,
}
const primaryBtn: React.CSSProperties = {
  padding: '14px', borderRadius: '14px', background: '#FF5A5F', color: '#fff',
  fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', width: '100%',
}
const softBtn: React.CSSProperties = {
  padding: '14px', borderRadius: '14px', background: '#F3F1EE', color: '#4A4458',
  fontSize: '15px', fontWeight: 700, border: 'none', cursor: 'pointer', width: '100%',
}
