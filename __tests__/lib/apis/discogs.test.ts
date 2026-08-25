import { searchVinyl, lookupVinylByBarcode, fetchVinylRelease, cleanArtistName } from '@/lib/apis/discogs'

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

  it('fetches one large page and reports hasMore=false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pagination: { pages: 36, page: 1 },
        results: Array.from({ length: 16 }, (_, i) => ({
          id: i + 1,
          master_id: i + 1,
          title: `Bruce Springsteen - Album ${i + 1}`,
          year: '1980',
          cover_image: null,
        }))
      })
    })
    // Collapsing makes the raw-to-card ratio vary per query, so a fixed
    // client-side offset step can no longer line up with Discogs pages.
    const { results, hasMore } = await searchVinyl('Bruce Springsteen')
    expect(results).toHaveLength(16)
    expect(hasMore).toBe(false)
    expect((mockFetch.mock.calls[0][0] as string)).toContain('per_page=100')
  })

  it('returns nothing for a non-zero offset rather than repeating page 1', async () => {
    const { results, hasMore } = await searchVinyl('Bruce Springsteen', 20)
    expect(results).toEqual([])
    expect(hasMore).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
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

  it('collapses pressings of the same album into one card', async () => {
    // Californication has 25 vinyl pressings; ungrouped they filled the whole
    // first page with the same record.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pagination: { pages: 4 },
        results: [
          { id: 403972,   master_id: 42546, title: 'Red Hot Chili Peppers - Californication', year: '1999', label: ['Warner Bros.'] },
          { id: 22983965, master_id: 42546, title: 'Red Hot Chili Peppers - Californication', year: '2021' },
          { id: 3971421,  master_id: 42546, title: 'Red Hot Chili Peppers - Californication', year: '2012' },
          { id: 3065687,  master_id: 99999, title: 'Red Hot Chili Peppers - Live Concert',    year: '2019' },
        ],
      })
    })
    const { results } = await searchVinyl('californication')
    expect(results).toHaveLength(2)
    expect(results[0].title).toBe('Californication')
    // Metadata comes from the highest-ranked pressing of the group
    expect(results[0].external_id).toBe('403972')
    expect(results[0].label).toBe('Warner Bros.')
  })

  it('reports the earliest pressing year, not the top hit\'s', async () => {
    // A release year is when that pressing was cut. The top hit for RHCP's
    // "Greatest Hits" is a 2016 reissue of a 2003 album, and that year drives
    // the collection's year sort and decade grouping.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pagination: { pages: 1 },
        results: [
          { id: 8, master_id: 500, title: 'Red Hot Chili Peppers - Greatest Hits', year: '2016' },
          { id: 9, master_id: 500, title: 'Red Hot Chili Peppers - Greatest Hits', year: '2003' },
        ],
      })
    })
    const { results } = await searchVinyl('greatest hits')
    expect(results).toHaveLength(1)
    expect(results[0].year).toBe(2003)
  })

  it('keeps master-less releases as their own cards', async () => {
    // One-off bootlegs have no master_id and must not collapse together.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pagination: { pages: 1 },
        results: [
          { id: 111, title: 'Artist - Bootleg One', year: '2019' },
          { id: 222, title: 'Artist - Bootleg Two', year: '2020' },
        ],
      })
    })
    const { results } = await searchVinyl('bootleg')
    expect(results.map(r => r.external_id)).toEqual(['111', '222'])
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

  it('scopes to artist= and release_title= when an artist is given', async () => {
    // Free text matches anywhere — artist, title, label, catno — so
    // "eric clapton unplugged" drags in his whole catalogue (9 cards).
    // Scoping the fields returns the one album.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pagination: { pages: 1 },
        results: [{ id: 412522, master_id: 55, title: 'Eric Clapton - Unplugged', year: '1992' }],
      })
    })
    const { results } = await searchVinyl('unplugged', 0, 'eric clapton')
    expect(results).toHaveLength(1)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('artist=eric%20clapton')
    expect(url).toContain('release_title=unplugged')
    expect(url).not.toContain('q=')
  })

  it('falls back to free text when the scoped search finds nothing', async () => {
    // Field search matches substrings but has no fuzzy matching, so swapped or
    // misremembered fields return nothing at all rather than a near miss.
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pagination: { pages: 1 }, results: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pagination: { pages: 1 },
          results: [{ id: 412522, master_id: 55, title: 'Eric Clapton - Unplugged', year: '1992' }],
        })
      })
    // Fields the wrong way round
    const { results } = await searchVinyl('eric clapton', 0, 'unplugged')
    expect(results).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect((mockFetch.mock.calls[1][0] as string)).toContain('q=unplugged%20eric%20clapton')
  })

  it('uses free text when only one field is filled', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ pagination: { pages: 1 }, results: [] }) })
    await searchVinyl('unplugged')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('q=unplugged')
    expect(url).not.toContain('release_title=')
  })

  it('ignores a whitespace-only artist rather than scoping on it', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ pagination: { pages: 1 }, results: [] }) })
    await searchVinyl('unplugged', 0, '   ')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect((mockFetch.mock.calls[0][0] as string)).not.toContain('artist=')
  })

  it('flags a 429 so it is not reported as "no results"', async () => {
    // Over the rate limit Discogs answers 429. Treating that the same as an
    // empty result set tells the user their record is not in the database.
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })
    const { results, rateLimited } = await searchVinyl('californication')
    expect(results).toEqual([])
    expect(rateLimited).toBe(true)
  })

  it('does not burn a second call on the fallback when already throttled', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })
    const { rateLimited } = await searchVinyl('unplugged', 0, 'eric clapton')
    expect(rateLimited).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('reports rateLimited=false for a genuine empty result', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ pagination: { pages: 1 }, results: [] }) })
    const { results, rateLimited } = await searchVinyl('zzzznotanalbum')
    expect(results).toEqual([])
    expect(rateLimited).toBe(false)
  })

  it('cleans Discogs markers off the artist in search results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        pagination: { pages: 1 },
        results: [{ id: 448759, master_id: 83128, title: 'Chicago (2) - Chicago', year: '1970' }],
      })
    })
    const { results } = await searchVinyl('chicago')
    expect(results[0].creator).toBe('Chicago')
    expect(results[0].title).toBe('Chicago')
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

describe('cleanArtistName', () => {
  it('strips the numeric disambiguator Discogs adds to same-named artists', () => {
    // Stored and displayed verbatim on the item card as "Chicago (2)".
    expect(cleanArtistName('Chicago (2)')).toBe('Chicago')
    expect(cleanArtistName('Sacred (2)')).toBe('Sacred')
    expect(cleanArtistName('Nirvana (15)')).toBe('Nirvana')
  })

  it('strips the trailing asterisk marking a release-specific spelling', () => {
    // The sleeve reads "Simon And Garfunkel"; the canonical artist is
    // "Simon & Garfunkel", and Discogs flags the difference with a *.
    expect(cleanArtistName('Simon And Garfunkel*')).toBe('Simon And Garfunkel')
    expect(cleanArtistName('The Mothers Of Invention*')).toBe('The Mothers Of Invention')
  })

  it('leaves names that legitimately end in parentheses alone', () => {
    expect(cleanArtistName('Heroes (Live)')).toBe('Heroes (Live)')
    expect(cleanArtistName('Everything But The Girl')).toBe('Everything But The Girl')
  })

  it('returns null for empty or missing input', () => {
    expect(cleanArtistName(null)).toBeNull()
    expect(cleanArtistName(undefined)).toBeNull()
    expect(cleanArtistName('   ')).toBeNull()
  })
})
