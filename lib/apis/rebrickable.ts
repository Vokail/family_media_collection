import type { SearchResult } from '../types'

const BASE = 'https://rebrickable.com/api/v3/lego'
const key = () => process.env.REBRICKABLE_API_KEY ?? ''

// Module-level cache — themes rarely change, reuse across requests for the lifetime
// of the serverless instance (re-fetched at most once per 24 hours)
const THEMES_TTL_MS = 24 * 60 * 60 * 1000
let themesCache: { promise: Promise<Map<number, string>>; fetchedAt: number } | null = null

async function getThemes(): Promise<Map<number, string>> {
  const now = Date.now()
  if (themesCache && now - themesCache.fetchedAt < THEMES_TTL_MS) {
    return themesCache.promise
  }
  const promise = (async () => {
    const map = new Map<number, string>()
    try {
      const res = await fetch(`${BASE}/themes/?page_size=1000&key=${key()}`)
      if (!res.ok) return map
      const data = await res.json()
      for (const t of data.results ?? []) map.set(t.id, t.name)
    } catch { /* ignore */ }
    return map
  })()
  themesCache = { promise, fetchedAt: now }
  return promise
}

/** Exposed for testing only — resets the themes cache */
export function _resetThemesCache() { themesCache = null }

function normalizeTheme(name: string): string {
  return name.replace(/\s+and\s+CUUSOO$/i, '')
}

function mapSet(s: Record<string, unknown>, themes: Map<number, string>): SearchResult {
  const theme = normalizeTheme(themes.get(s.theme_id as number) ?? 'LEGO')
  return {
    external_id: s.set_num as string,
    title: s.name as string,
    creator: theme,
    year: (s.year as number) ?? null,
    cover_url: (s.set_img_url as string) || null,
    source: 'rebrickable',
    num_parts: typeof s.num_parts === 'number' ? s.num_parts : null,
  }
}

export async function searchLego(query: string, offset = 0): Promise<{ results: SearchResult[], hasMore: boolean }> {
  try {
    const [themesMap, res] = await Promise.all([
      getThemes(),
      fetch(`${BASE}/sets/?search=${encodeURIComponent(query)}&page_size=20&offset=${offset}&key=${key()}&ordering=-year`),
    ])
    if (!res.ok) return { results: [], hasMore: false }
    const data = await res.json()
    return {
      results: (data.results ?? []).map((s: Record<string, unknown>) => mapSet(s, themesMap)),
      hasMore: data.next !== null && data.next !== undefined,
    }
  } catch {
    return { results: [], hasMore: false }
  }
}

export async function lookupLegoBySetNum(setNum: string): Promise<SearchResult | null> {
  // Try with and without the "-1" variant suffix
  const variants = [setNum, `${setNum}-1`]
  const themes = await getThemes()
  for (const v of variants) {
    try {
      const res = await fetch(`${BASE}/sets/${encodeURIComponent(v)}/?key=${key()}`)
      if (res.ok) {
        const s = await res.json()
        return mapSet(s, themes)
      }
    } catch { /* try next */ }
  }
  return null
}

// Look up a LEGO set by EAN/UPC barcode.
// Uses upcitemdb (no API key required, 100 req/day free tier) to resolve
// EAN → LEGO set number, then fetches full metadata from Rebrickable.
export async function lookupLegoByEAN(ean: string): Promise<SearchResult | null> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(ean)}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return null
    const data = await res.json()
    const item = data.items?.[0]
    if (!item) return null

    // upcitemdb returns the LEGO set number in the `model` field (e.g. "75192")
    const model = (item.model as string | undefined)?.trim()
    if (model && /^\d{4,6}$/.test(model)) {
      return lookupLegoBySetNum(model)
    }

    // Fallback: extract a 4-6 digit number from the product title
    const title = (item.title as string | undefined) ?? ''
    const match = title.match(/\b(\d{4,6})\b/)
    if (match) {
      return lookupLegoBySetNum(match[1])
    }

    return null
  } catch {
    return null
  }
}
