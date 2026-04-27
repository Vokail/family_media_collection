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

  // Always fetch page navigations from network — HTML must be fresh for correct icon/meta resolution
  // Falls back to cache only when fully offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(cached => cached ?? caches.match('/members'))
      )
    )
  }
})
