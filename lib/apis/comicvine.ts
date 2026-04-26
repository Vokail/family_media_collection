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

export async function searchComics(query: string, lang?: string, offset = 0): Promise<SearchResult[]> {
  const q = lang && lang !== 'all' && LANG_TERMS[lang]
    ? `${query} ${LANG_TERMS[lang]}`
    : query
  const url = `${BASE}/search/?api_key=${process.env.COMICVINE_API_KEY}&format=json&query=${encodeURIComponent(q)}&resources=volume&field_list=id,name,start_year,image,publisher&limit=20&offset=${offset}`
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

export async function fetchComicDescription(externalId: string): Promise<string | null> {
  try {
    const url = `${BASE}/volume/4050-${externalId}/?api_key=${process.env.COMICVINE_API_KEY}&format=json&field_list=deck,description`
    const res = await fetch(url, { headers: CV_HEADERS, signal: AbortSignal.timeout(9000) })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status_code !== 1) return null
    const deck = data.results?.deck as string | null
    const raw = data.results?.description as string | null
    return deck || (raw ? stripHtml(raw).slice(0, 1000) : null)
  } catch { return null }
}

export async function lookupComicByBarcode(barcode: string): Promise<SearchResult | null> {
  // Comic/manga volumes have ISBN barcodes — try book lookup first
  if (/^\d{10,13}$/.test(barcode)) {
    try {
      const { lookupBookByISBN } = await import('./openlibrary')
      const book = await lookupBookByISBN(barcode)
      if (book) return { ...book, source: 'comicvine' }
    } catch { /* fall through */ }
  }
  const results = await searchComics(barcode)
  return results[0] ?? null
}
