// Separate module so the cache can be reset in tests without exporting
// from the Next.js route file (which rejects non-handler exports).

let cachedModel: string | null = null
let cacheExpiry = 0

export function getCachedModel(): string | null {
  return Date.now() < cacheExpiry ? cachedModel : null
}

export function setCachedModel(model: string) {
  cachedModel = model
  cacheExpiry = Date.now() + 60 * 60 * 1000 // 1 hour
}

export function clearModelCache() {
  cachedModel = null
  cacheExpiry = 0
}
