'use client'
import { useState, useEffect } from 'react'

const KEY = 'bbopbbop_onboarded'

export function useOnboarding() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // 첫 방문자에게만 온보딩 표시
    if (!localStorage.getItem(KEY)) {
      setShow(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(KEY, '1')
    setShow(false)
  }

  return { show, dismiss }
}
