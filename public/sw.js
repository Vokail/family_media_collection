const CACHE = 'oc-v4'
const COVERS_CACHE = 'oc-covers-v1'
const COVERS_MAX = 500 // max cached cover images

self.addEventListener('install', e => {
  // Pre-cache the offline fallback so it's always available
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.add('/offline')).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== COVERS_CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

async function cacheCoversFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) {
    const cache = await caches.open(COVERS_CACHE)
    // Evict oldest entries if at limit
    const keys = await cache.keys()
    if (keys.length >= COVERS_MAX) {
      await cache.delete(keys[0])
    }
    cache.put(request, res.clone())
  }
  return res
}

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Never cache API routes — always need fresh data
  if (url.pathname.startsWith('/api/')) return

  // Cache-first for Supabase Storage covers (URL contains UUID, so never stale)
  if (url.pathname.includes('/storage/v1/object/public/covers/')) {
    e.respondWith(cacheCoversFirst(request))
    return
  }

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

  // Network-first for page navigations — falls back to cached page, then /offline
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(cached => cached ?? caches.match('/offline'))
      )
    )
  }
})
