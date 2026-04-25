import type { SearchResult } from '../types'

const BASE = 'https://comicvine.gamespot.com/api'

const CV_HEADERS = {
  'User-Agent': 'FamilyMediaCollection/1.0',
  'Accept': 'application/json',
}

const LANG_TERMS: Record<string, string> = {
  dutch: 'Dutch',
  english: 'English',
  french: 'French',
  german: 'German',
}

export async function searchComics(query: string, lang?: string): Promise<SearchResult[]> {
  const q = lang && lang !== 'all' && LANG_TERMS[lang]
    ? `${query} ${LANG_TERMS[lang]}`
    : query
  const url = `${BASE}/search/?api_key=${process.env.COMICVINE_API_KEY}&format=json&query=${encodeURIComponent(q)}&resources=volume&field_list=id,name,start_year,image,publisher&limit=10`
  try {
    const res = await fetch(url, { headers: CV_HEADERS })
    if (!res.ok) return []
    const data = await res.json()
    if (data.status_code !== 1) return []
    return (data.results ?? []).map((r: Record<string, unknown>) => ({
      external_id: String(r.id),
      title: r.name as string,
      creator: (r.publisher as Record<string, string>)?.name ?? 'Unknown',
      year: r.start_year ? parseInt(r.start_year as string) : null,
      cover_url: (r.image as Record<string, string>)?.medium_url ?? null,
      source: 'comicvine' as const,
    }))
  } catch {
    return []
  }
}

export async function lookupComicByBarcode(barcode: string): Promise<SearchResult | null> {
  const results = await searchComics(barcode)
  return results[0] ?? null
}
