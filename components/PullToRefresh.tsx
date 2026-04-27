'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState, useCallback } from 'react'

const PULL_THRESHOLD = 72

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const pulling = useRef(false)

  const doRefresh = useCallback(async () => {
    setRefreshing(true)
    router.refresh()
    // Give server components time to re-render
    await new Promise(r => setTimeout(r, 800))
    setRefreshing(false)
  }, [router])

  function onTouchStart(e: React.TouchEvent) {
    if ((window.scrollY ?? document.documentElement.scrollTop ?? 0) <= 0) {
      touchStartY.current = e.touches[0].clientY
      pulling.current = true
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!pulling.current) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) setPullY(Math.min(dy * 0.5, PULL_THRESHOLD + 20))
  }

  function onTouchEnd() {
    if (pulling.current && pullY >= PULL_THRESHOLD && !refreshing) doRefresh()
    pulling.current = false
    setPullY(0)
  }

  const pullProgress = Math.min(pullY / PULL_THRESHOLD, 1)
  const pullTriggered = pullY >= PULL_THRESHOLD

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {(pullY > 0 || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: refreshing ? 48 : pullY, opacity: refreshing ? 1 : pullProgress }}
        >
          <div
            className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: 'var(--accent)',
              transform: refreshing ? 'none' : `rotate(${pullProgress * 180}deg)`,
              animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
            }}
          >
            {refreshing ? (
              <div className="w-3 h-3 rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: pullTriggered ? 'var(--accent)' : 'var(--text-muted)' }}>
                <path d="M6 1v8M3 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
