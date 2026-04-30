'use client'

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
      <span className="text-6xl">📡</span>
      <h1 className="text-2xl font-serif font-bold">You&apos;re offline</h1>
      <p className="subtitle max-w-xs">
        No internet connection right now. Previously visited pages and cover images are still
        available — go back or{' '}
        <a href="/members" className="underline" style={{ color: 'var(--accent)' }}>
          return to the collection
        </a>
        .
      </p>
      <button
        onClick={() => window.location.reload()}
        className="btn-primary"
      >
        Try again
      </button>
    </main>
  )
}
