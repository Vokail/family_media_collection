import type { SearchResult } from '../types'

const BASE = 'https://comicvine.gamespot.com/api'

export async function searchComics(query: string): Promise<SearchResult[]> {
  const url = `${BASE}/search/?api_key=${process.env.COMICVINE_API_KEY}&format=json&query=${encodeURIComponent(query)}&resources=volume&field_list=id,name,start_year,image,publisher&limit=10`
  const res = await fetch(url, { headers: { 'User-Agent': 'FamilyMediaCollection/1.0' } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []).map((r: Record<string, unknown>) => ({
    external_id: String(r.id),
    title: r.name as string,
    creator: (r.publisher as Record<string, string>)?.name ?? 'Unknown',
    year: r.start_year ? parseInt(r.start_year as string) : null,
    cover_url: (r.image as Record<string, string>)?.medium_url ?? null,
    source: 'comicvine' as const,
  }))
}

export async function lookupComicByBarcode(barcode: string): Promise<SearchResult | null> {
  const results = await searchComics(barcode)
  return results[0] ?? null
}
