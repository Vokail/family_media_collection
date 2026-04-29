'use client'
import { useRef } from 'react'

export default function AppVersion() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '—'
  const tapCount = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTap() {
    tapCount.current += 1
    if (tapCount.current === 2) {
      tapCount.current = 0
      if (tapTimer.current) clearTimeout(tapTimer.current)
      window.location.reload()
      return
    }
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0
    }, 300)
  }

  return (
    <p
      onClick={handleTap}
      className="text-center text-xs select-none"
      style={{ color: 'var(--text-muted)' }}
    >
      v{version}
    </p>
  )
}
