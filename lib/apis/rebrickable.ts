import type { SearchResult } from '../types'

const BASE = 'https://rebrickable.com/api/v3/lego'
const key = () => process.env.REBRICKABLE_API_KEY ?? ''

// Fetch and cache theme map for the lifetime of the request
async function getThemes(): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  try {
    const res = await fetch(`${BASE}/themes/?page_size=1000&key=${key()}`)
    if (!res.ok) return map
    const data = await res.json()
    for (const t of data.results ?? []) map.set(t.id, t.name)
  } catch { /* ignore */ }
  return map
}

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
  }
}

export async function searchLego(query: string, offset = 0): Promise<SearchResult[]> {
  try {
    const [themesMap, res] = await Promise.all([
      getThemes(),
      fetch(`${BASE}/sets/?search=${encodeURIComponent(query)}&page_size=20&offset=${offset}&key=${key()}&ordering=-year`),
    ])
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((s: Record<string, unknown>) => mapSet(s, themesMap))
  } catch {
    return []
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
