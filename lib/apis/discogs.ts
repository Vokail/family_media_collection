import type { SearchResult, Track } from '../types'

const BASE = 'https://api.discogs.com'
const headers = () => ({
  Authorization: `Discogs token=${process.env.DISCOGS_API_KEY}`,
  'User-Agent': 'FamilyMediaCollection/1.0',
})

function parseDiscogsTitle(raw: string): { title: string; creator: string } {
  const parts = raw.split(' - ')
  if (parts.length >= 2) return { creator: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
  return { creator: 'Unknown', title: raw }
}

function mapResult(r: Record<string, unknown>): SearchResult {
  const { title, creator } = parseDiscogsTitle(r.title as string)
  return {
    external_id: String(r.id),
    title,
    creator,
    year: r.year ? parseInt(r.year as string) : null,
    cover_url: (r.cover_image as string) || null,
    source: 'discogs',
  }
}

export async function searchVinyl(query: string): Promise<SearchResult[]> {
  const url = `${BASE}/database/search?q=${encodeURIComponent(query)}&type=release&format=vinyl&per_page=10`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []).map(mapResult)
}

export async function fetchVinylRelease(releaseId: string): Promise<{ tracklist: Track[]; sortName: string | null }> {
  const url = `${BASE}/releases/${releaseId}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return { tracklist: [], sortName: null }
  const data = await res.json()
  const tracklist = (data.tracklist ?? []).map((t: Record<string, unknown>) => ({
    position: (t.position as string) || '',
    title: (t.title as string) || '',
    duration: (t.duration as string) || null,
  }))
  // artists_sort is the Discogs filing name e.g. "Sinatra, Frank" or "Dire Straits"
  const sortName = (data.artists_sort as string) || null
  return { tracklist, sortName }
}

export async function lookupVinylByBarcode(barcode: string): Promise<SearchResult | null> {
  const url = `${BASE}/database/search?barcode=${barcode}&per_page=5`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.results?.length) return null
  return mapResult(data.results[0])
}
