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
  const formats = r.format as string[] | undefined
  const labels = r.label as string[] | undefined
  const catnos = r.catno as string | undefined
  const genres = r.genre as string[] | undefined
  const styles = r.style as string[] | undefined
  return {
    external_id: String(r.id),
    title,
    creator,
    year: r.year ? parseInt(r.year as string) : null,
    cover_url: (r.cover_image as string) || null,
    source: 'discogs',
    format: formats?.filter(f => !['Vinyl'].includes(f)).join(', ') || null,
    label: labels?.[0] ?? null,
    country: (r.country as string) || null,
    catno: catnos || null,
    genres: genres?.join(', ') || null,
    styles: styles?.join(', ') || null,
  }
}

export async function searchVinyl(query: string, offset = 0): Promise<{ results: SearchResult[]; hasMore: boolean }> {
  const page = Math.floor(offset / 20) + 1
  const url = `${BASE}/database/search?q=${encodeURIComponent(query)}&type=master&format=vinyl&per_page=20&page=${page}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return { results: [], hasMore: false }
  const data = await res.json()
  const totalPages: number = data.pagination?.pages ?? 1
  return {
    results: (data.results ?? []).map(mapResult),
    hasMore: page < totalPages,
  }
}

export async function fetchVinylRelease(id: string): Promise<{
  tracklist: Track[]
  sortName: string | null
  genres: string | null
  styles: string | null
}> {
  // Search results use master IDs; barcode lookups return release IDs.
  // Try master endpoint first and fall back to release so both work.
  for (const path of [`/masters/${id}`, `/releases/${id}`]) {
    const res = await fetch(`${BASE}${path}`, { headers: headers() })
    if (!res.ok) continue
    const data = await res.json()
    const tracklist = (data.tracklist ?? []).map((t: Record<string, unknown>) => ({
      position: (t.position as string) || '',
      title: (t.title as string) || '',
      duration: (t.duration as string) || null,
    }))
    // artists_sort exists on releases; masters have an artists array instead
    const sortName = (data.artists_sort as string)
      || (data.artists as { name: string }[])?.[0]?.name
      || null
    const genres = (data.genres as string[])?.join(', ') || null
    const styles = (data.styles as string[])?.join(', ') || null
    return { tracklist, sortName, genres, styles }
  }
  return { tracklist: [], sortName: null, genres: null, styles: null }
}

export async function lookupVinylByBarcode(barcode: string): Promise<SearchResult | null> {
  const url = `${BASE}/database/search?barcode=${barcode}&per_page=5`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.results?.length) return null
  return mapResult(data.results[0])
}
