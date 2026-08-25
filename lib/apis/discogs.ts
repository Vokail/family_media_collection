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

// One generous page instead of paging. Collapsing pressings (below) makes the
// raw-results-to-cards ratio vary per query, so a fixed client-side offset step
// can no longer line up with Discogs pages — and the same album would reappear
// later under a different pressing id, slipping past the client's external_id
// dedupe. 100 pressings reliably covers every distinct album for a real query;
// beyond that, adding the artist to the query beats paging through reissues.
const VINYL_SEARCH_PER_PAGE = 100

type RawResult = Record<string, unknown>

const yearOf = (r: RawResult): number | null => {
  const y = parseInt(String(r.year ?? ''))
  return Number.isFinite(y) ? y : null
}

/**
 * Collapse the pressings of one album into a single card.
 *
 * Discogs release results carry the `master_id` of the album they press, so
 * they can be grouped without extra lookups. Californication alone has 25 vinyl
 * pressings; ungrouped they filled the whole first page with the same record.
 *
 * Metadata comes from the highest-ranked pressing (best cover and label data),
 * but the year is the group's earliest. A release's year is when *that pressing*
 * was cut, so the top hit for RHCP's "Greatest Hits" reports 2016 for a 2003
 * album — and that year feeds the collection's year sort and decade grouping.
 *
 * Releases with no master (one-off bootlegs) stand alone, keyed by release id.
 */
function collapsePressings(raw: RawResult[]): SearchResult[] {
  const groups = new Map<string, RawResult[]>()
  for (const r of raw) {
    const key = r.master_id ? `master:${r.master_id}` : `release:${r.id}`
    const existing = groups.get(key)
    if (existing) existing.push(r)
    else groups.set(key, [r])
  }

  return Array.from(groups.values()).map(group => {
    const card = mapResult(group[0])
    const years = group.map(yearOf).filter((y): y is number => y !== null)
    return years.length ? { ...card, year: Math.min(...years) } : card
  })
}

/**
 * Search Discogs for vinyl albums.
 *
 * Searches releases, not masters. A master inherits its format from its *main*
 * release, so `type=master&format=vinyl` silently drops any album whose primary
 * pressing was a CD — which is most of 1990-2010. Searching "californication"
 * that way returned two bootlegs and not the Red Hot Chili Peppers album, whose
 * master is a CD despite 67 vinyl pressings existing.
 *
 * Results are then collapsed back to one card per album, so searching releases
 * does not mean picking through 25 near-identical rows.
 */
/**
 * Discogs allows 60 requests/minute with a token, 25 without. Over that it
 * answers 429, which is not the same as an album being absent — reporting both
 * as "no results" tells the user their record isn't in the database when it is.
 */
async function fetchCollapsed(params: string): Promise<{ results: SearchResult[]; rateLimited: boolean }> {
  const url = `${BASE}/database/search?${params}&type=release&format=vinyl&per_page=${VINYL_SEARCH_PER_PAGE}&page=1`
  const res = await fetch(url, { headers: headers() })
  if (res.status === 429) return { results: [], rateLimited: true }
  if (!res.ok) return { results: [], rateLimited: false }
  const data = await res.json()
  return { results: collapsePressings(data.results ?? []), rateLimited: false }
}

export async function searchVinyl(
  query: string,
  offset = 0,
  artist?: string,
): Promise<{ results: SearchResult[]; hasMore: boolean; rateLimited: boolean }> {
  // Everything worth showing is in the single page fetched below.
  if (offset > 0) return { results: [], hasMore: false, rateLimited: false }

  const scopedArtist = artist?.trim()
  if (scopedArtist && query.trim()) {
    // Scoping the fields beats free text, which matches anywhere — artist,
    // title, label, catalogue number — so "eric clapton unplugged" drags in his
    // whole catalogue. artist= plus release_title= returns the one album.
    const scoped = await fetchCollapsed(
      `artist=${encodeURIComponent(scopedArtist)}&release_title=${encodeURIComponent(query)}`,
    )
    if (scoped.results.length) return { ...scoped, hasMore: false }
    // Already throttled — a second call would only be refused too.
    if (scoped.rateLimited) return { ...scoped, hasMore: false }
    // Field search matches substrings but has no fuzzy matching, so a swapped or
    // misremembered field returns nothing at all. Fall through to free text
    // rather than leaving the user at a dead end.
  }

  const freeText = [scopedArtist, query].filter(Boolean).join(' ')
  const fallback = await fetchCollapsed(`q=${encodeURIComponent(freeText)}`)
  return { ...fallback, hasMore: false }
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
