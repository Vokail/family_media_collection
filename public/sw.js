const CACHE = 'oc-v2'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Never cache API routes or admin routes — always need fresh data
  if (url.pathname.startsWith('/api/')) return

  // Cache-first for Next.js static assets (hashed filenames — never change)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(request).then(cached =>
        cached ?? fetch(request).then(res => {
          caches.open(CACHE).then(c => c.put(request, res.clone()))
          return res
        })
      )
    )
    return
  }

  // Stale-while-revalidate for page navigations — load cached instantly, update in background
  if (request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone())
            return res
          }).catch(() => cached)
          return cached ?? networkFetch
        })
      )
    )
  }
})
