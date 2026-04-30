import { searchVinyl, lookupVinylByBarcode, fetchVinylRelease } from '@/lib/apis/discogs'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

beforeEach(() => (fetch as jest.Mock).mockReset())

describe('searchVinyl', () => {
  it('returns mapped results from Discogs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          id: 1001,
          title: 'Pink Floyd - The Dark Side of the Moon',
          year: '1973',
          cover_image: 'https://example.com/cover.jpg',
        }]
      })
    })
    const results = await searchVinyl('Dark Side of the Moon')
    expect(results[0]).toMatchObject({
      external_id: '1001',
      title: 'The Dark Side of the Moon',
      creator: 'Pink Floyd',
      year: 1973,
      cover_url: 'https://example.com/cover.jpg',
      source: 'discogs',
    })
  })

  it('includes format, label, country, catno, genres and styles when present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
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
    const results = await searchVinyl('Abbey Road')
    expect(results[0]).toMatchObject({
      external_id: '1002',
      format: 'LP, Album',   // "Vinyl" stripped
      label: 'Apple Records', // first label
      country: 'UK',
      catno: 'PCS 7088',
      genres: 'Rock',
      styles: 'Psychedelic Rock, Classic Rock',
    })
  })

  it('returns empty array on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await searchVinyl('x')).toEqual([])
  })
})

describe('lookupVinylByBarcode', () => {
  it('returns first result matching barcode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: 2002, title: 'Artist - Album', year: '1980', cover_image: null }]
      })
    })
    const result = await lookupVinylByBarcode('0724389862027')
    expect(result).not.toBeNull()
    expect(result!.external_id).toBe('2002')
  })

  it('returns null when no results', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
    expect(await lookupVinylByBarcode('000')).toBeNull()
  })
})

describe('fetchVinylRelease', () => {
  it('uses master endpoint first and returns data when it succeeds', async () => {
    // First call = /masters/:id — succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        // Masters have artists array, not artists_sort
        artists: [{ name: 'Pink Floyd' }],
        genres: ['Rock'],
        styles: ['Psychedelic Rock'],
        tracklist: [{ position: 'A1', title: 'Speak to Me', duration: '1:30' }],
      })
    })
    const { tracklist, sortName, genres, styles } = await fetchVinylRelease('12345')
    expect(sortName).toBe('Pink Floyd') // falls back to artists[0].name
    expect(genres).toBe('Rock')
    expect(styles).toBe('Psychedelic Rock')
    expect(tracklist).toHaveLength(1)
    // Should NOT have made a second fetch (release fallback not needed)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect((mockFetch.mock.calls[0][0] as string)).toContain('/masters/12345')
  })

  it('falls back to release endpoint when master returns 404', async () => {
    // First call = /masters/:id — fails
    mockFetch.mockResolvedValueOnce({ ok: false })
    // Second call = /releases/:id — succeeds
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
    expect(sortName).toBe('Beatles, The') // from artists_sort on release
    expect(genres).toBe('Rock')
    expect(tracklist).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect((mockFetch.mock.calls[1][0] as string)).toContain('/releases/67890')
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

  it('returns nulls and empty tracklist when both endpoints fail', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false }) // masters fails
    mockFetch.mockResolvedValueOnce({ ok: false }) // releases fails
    const { tracklist, sortName, genres, styles } = await fetchVinylRelease('99999')
    expect(tracklist).toEqual([])
    expect(sortName).toBeNull()
    expect(genres).toBeNull()
    expect(styles).toBeNull()
  })
})
