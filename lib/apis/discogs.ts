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
  // A release spanning several discs repeats its format tokens
  // (e.g. ['Vinyl','LP','Vinyl','LP','All Media','Album']), so dedupe before
  // display or the chip reads "LP, LP, All Media, Album".
  const formatTokens = Array.from(new Set(formats ?? [])).filter(f => f !== 'Vinyl')
  return {
    external_id: String(r.id),
    title,
    creator,
    year: r.year ? parseInt(r.year as string) : null,
    cover_url: (r.cover_image as string) || null,
    source: 'discogs',
    format: formatTokens.join(', ') || null,
    label: labels?.[0] ?? null,
    country: (r.country as string) || null,
    catno: catnos || null,
    genres: genres?.join(', ') || null,
    styles: styles?.join(', ') || null,
  }
}

/**
 * Search Discogs for vinyl pressings.
 *
 * Searches releases, not masters. A master inherits its format from its *main*
 * release, so `type=master&format=vinyl` silently drops any album whose primary
 * pressing was a CD — which is most of 1990-2010. Searching "californication"
 * that way returned two bootlegs and not the Red Hot Chili Peppers album, whose
 * master is a CD despite 67 vinyl pressings existing.
 *
 * The trade-off is that each pressing is its own result, so popular albums
 * return many near-identical rows. That is what the format/label/country/catno
 * chips on the search cards are for.
 */
export async function searchVinyl(query: string, offset = 0): Promise<{ results: SearchResult[]; hasMore: boolean }> {
  const page = Math.floor(offset / 20) + 1
  const url = `${BASE}/database/search?q=${encodeURIComponent(query)}&type=release&format=vinyl&per_page=20&page=${page}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return { results: [], hasMore: false }
  const data = await res.json()
  const totalPages: number = data.pagination?.pages ?? 1
  return {
    results: (data.results ?? []).map(mapResult),
    hasMore: page < totalPages,
  }
}

/**
 * Fetch tracklist and metadata for a Discogs **release** id.
 *
 * Deliberately hits one endpoint and does not fall back to /masters. Master and
 * release ids are separate but similarly dense numeric namespaces: a release id
 * below roughly 3.5M is almost always also a valid master id pointing at an
 * unrelated record. Trying /masters first therefore returned the wrong record
 * with HTTP 200 rather than failing over — release 2849974 is Joe Bonamassa's
 * "Live From The Royal Albert Hall", while master 2849974 is "Ö (3) —
 * Hypernormality", and the collection stored the latter's five tracks.
 *
 * Both callers (adding an item, and the search-result tracklist preview) pass an
 * id that came from searchVinyl or lookupVinylByBarcode, and both of those now
 * return release ids, so there is nothing to disambiguate.
 */
export async function fetchVinylRelease(releaseId: string): Promise<{
  tracklist: Track[]
  sortName: string | null
  genres: string | null
  styles: string | null
}> {
  const empty = { tracklist: [], sortName: null, genres: null, styles: null }
  const res = await fetch(`${BASE}/releases/${releaseId}`, { headers: headers() })
  if (!res.ok) return empty
  const data = await res.json()
  const tracklist = (data.tracklist ?? []).map((t: Record<string, unknown>) => ({
    position: (t.position as string) || '',
    title: (t.title as string) || '',
    duration: (t.duration as string) || null,
  }))
  const sortName = (data.artists_sort as string)
    || (data.artists as { name: string }[])?.[0]?.name
    || null
  return {
    tracklist,
    sortName,
    genres: (data.genres as string[])?.join(', ') || null,
    styles: (data.styles as string[])?.join(', ') || null,
  }
}

/**
 * Look up a scanned barcode.
 *
 * Filtered to vinyl: an unfiltered barcode search happily returns the CD or DVD
 * edition, which is how a DVD of Eric Clapton's "Unplugged" and six CDs ended up
 * in the vinyl collection carrying CD track numbering (1, 2, 3) instead of side
 * positions (A1, A2, B1). Masters are skipped for the reason in
 * fetchVinylRelease — the id it returns must be a release id.
 */
export async function lookupVinylByBarcode(barcode: string): Promise<SearchResult | null> {
  const url = `${BASE}/database/search?barcode=${encodeURIComponent(barcode)}&type=release&format=vinyl&per_page=5`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return null
  const data = await res.json()
  const release = (data.results ?? []).find((r: Record<string, unknown>) => r.type === 'release')
  return release ? mapResult(release) : null
}
