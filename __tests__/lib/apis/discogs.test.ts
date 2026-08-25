import { searchVinyl, lookupVinylByBarcode, fetchVinylRelease } from '@/lib/apis/discogs'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

beforeEach(() => (fetch as jest.Mock).mockReset())

describe('searchVinyl', () => {
  it('returns mapped results and hasMore=false when on the only page', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pagination: { pages: 1, page: 1 },
        results: [{
          id: 1001,
          title: 'Pink Floyd - The Dark Side of the Moon',
          year: '1973',
          cover_image: 'https://example.com/cover.jpg',
        }]
      })
    })
    const { results, hasMore } = await searchVinyl('Dark Side of the Moon')
    expect(results[0]).toMatchObject({
      external_id: '1001',
      title: 'The Dark Side of the Moon',
      creator: 'Pink Floyd',
      year: 1973,
      cover_url: 'https://example.com/cover.jpg',
      source: 'discogs',
    })
    expect(hasMore).toBe(false)
  })

  it('returns hasMore=true when more pages exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pagination: { pages: 36, page: 1 },
        results: Array.from({ length: 16 }, (_, i) => ({
          id: i + 1,
          title: `Bruce Springsteen - Album ${i + 1}`,
          year: '1980',
          cover_image: null,
        }))
      })
    })
    // 16 results on page 1 but 36 total pages — hasMore must be true
    const { results, hasMore } = await searchVinyl('Bruce Springsteen')
    expect(results).toHaveLength(16)
    expect(hasMore).toBe(true)
  })

  it('includes format, label, country, catno, genres and styles when present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pagination: { pages: 1, page: 1 },
        results: [{
          id: 1002,
          title: 'The Beatles - Abbey Road',
          year: '1969',
          cover_image: null,
          format: ['Vinyl', 'LP', 'Album'],
          label: ['Apple Records', 'Parlophone'],
          country: 'UK',
          catno: 'PCS 7088',
          genre: ['Rock'],
          style: ['Psychedelic Rock', 'Classic Rock'],
        }]
      })
    })
    const { results } = await searchVinyl('Abbey Road')
    expect(results[0]).toMatchObject({
      external_id: '1002',
      format: 'LP, Album',    // "Vinyl" stripped
      label: 'Apple Records', // first label
      country: 'UK',
      catno: 'PCS 7088',
      genres: 'Rock',
      styles: 'Psychedelic Rock, Classic Rock',
    })
  })

  it('searches releases, not masters (#californication)', async () => {
    // A master takes its format from its *main* release, so type=master with
    // format=vinyl drops any album whose primary pressing was a CD. Searching
    // "californication" that way returned two bootlegs and not the RHCP album.
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ pagination: { pages: 1 }, results: [] }) })
    await searchVinyl('californication')
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('type=release')
    expect(url).toContain('format=vinyl')
    expect(url).not.toContain('type=master')
  })

  it('dedupes repeated format tokens from multi-disc releases', async () => {
    // A 2LP release repeats its tokens: ['Vinyl','LP','Vinyl','LP','Album'],
    // which rendered as "LP, LP, Album" on the search card.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pagination: { pages: 1 },
        results: [{
          id: 31323387, title: 'Red Hot Chili Peppers - Californication',
          format: ['Vinyl', 'LP', 'Vinyl', 'LP', 'All Media', 'Album'],
        }],
      })
    })
    const { results } = await searchVinyl('californication')
    expect(results[0].format).toBe('LP, All Media, Album')
  })

  it('returns empty results and hasMore=false on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const { results, hasMore } = await searchVinyl('x')
    expect(results).toEqual([])
    expect(hasMore).toBe(false)
  })
})

describe('lookupVinylByBarcode', () => {
  it('returns first release result matching barcode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: 2002, type: 'release', title: 'Artist - Album', year: '1980', cover_image: null }]
      })
    })
    const result = await lookupVinylByBarcode('0724389862027')
    expect(result).not.toBeNull()
    expect(result!.external_id).toBe('2002')
  })

  it('restricts the lookup to vinyl releases', async () => {
    // Without format=vinyl a scan happily matched the CD or DVD edition, which
    // is how a DVD of Clapton's "Unplugged" landed in the vinyl collection with
    // CD-style track numbering instead of A1/B1 side positions.
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
    await lookupVinylByBarcode('0724389862027')
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('format=vinyl')
    expect(url).toContain('type=release')
  })

  it('skips master results so the stored id is always a release id', async () => {
    // Barcode search returns a mix of masters and releases; fetchVinylRelease
    // only reads /releases, so a master id here would resolve to nothing.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: 490614, type: 'master', title: 'Artist - Album', year: '1999' },
          { id: 4002111, type: 'release', title: 'Artist - Album', year: '1999' },
        ]
      })
    })
    const result = await lookupVinylByBarcode('0724389862027')
    expect(result!.external_id).toBe('4002111')
  })

  it('returns null when no results', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
    expect(await lookupVinylByBarcode('000')).toBeNull()
  })
})

describe('fetchVinylRelease', () => {
  it('hits the release endpoint and returns its data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        artists_sort: 'Beatles, The',
        genres: ['Rock'],
        styles: ['Classic Rock'],
        tracklist: [{ position: 'A1', title: 'Come Together', duration: '4:20' }],
      })
    })
    const { tracklist, sortName, genres, styles } = await fetchVinylRelease('67890')
    expect(sortName).toBe('Beatles, The')
    expect(genres).toBe('Rock')
    expect(styles).toBe('Classic Rock')
    expect(tracklist).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect((mockFetch.mock.calls[0][0] as string)).toContain('/releases/67890')
  })

  it('never falls back to /masters — the id spaces overlap (#collision)', async () => {
    // Regression guard. Master and release ids are separate but similarly dense
    // namespaces: /masters/2849974 is "Ö (3) — Hypernormality" while
    // /releases/2849974 is Joe Bonamassa. A master-first lookup returned the
    // wrong record with HTTP 200 and stored its 5 tracks against the Bonamassa
    // item, so a failed release lookup must yield nothing rather than guess.
    mockFetch.mockResolvedValueOnce({ ok: false })
    const { tracklist, sortName } = await fetchVinylRelease('2849974')
    expect(tracklist).toEqual([])
    expect(sortName).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect((mockFetch.mock.calls[0][0] as string)).not.toContain('/masters/')
  })

  it('falls back to artists[0].name when artists_sort is absent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        artists: [{ name: 'Pink Floyd' }],
        genres: ['Rock'],
        styles: ['Psychedelic Rock'],
        tracklist: [{ position: 'A1', title: 'Speak to Me', duration: '1:30' }],
      })
    })
    const { sortName, styles } = await fetchVinylRelease('12345')
    expect(sortName).toBe('Pink Floyd')
    expect(styles).toBe('Psychedelic Rock')
  })

  it('prefers artists_sort over artists[0].name when both present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        artists_sort: 'Sinatra, Frank',
        artists: [{ name: 'Frank Sinatra' }],
        genres: ['Jazz'],
        styles: [],
        tracklist: [],
      })
    })
    const { sortName } = await fetchVinylRelease('111')
    expect(sortName).toBe('Sinatra, Frank')
  })

  it('returns nulls and empty tracklist when the release lookup fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const { tracklist, sortName, genres, styles } = await fetchVinylRelease('99999')
    expect(tracklist).toEqual([])
    expect(sortName).toBeNull()
    expect(genres).toBeNull()
    expect(styles).toBeNull()
  })
})
