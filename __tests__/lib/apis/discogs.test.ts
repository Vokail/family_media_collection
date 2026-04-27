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
  it('returns tracklist, sortName, genres and styles from a release', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        artists_sort: 'Beatles, The',
        genres: ['Rock'],
        styles: ['Psychedelic Rock', 'Classic Rock'],
        tracklist: [
          { position: 'A1', title: 'Come Together', duration: '4:20' },
          { position: 'A2', title: 'Something', duration: '3:03' },
        ],
      })
    })
    const { tracklist, sortName, genres, styles } = await fetchVinylRelease('12345')
    expect(sortName).toBe('Beatles, The')
    expect(genres).toBe('Rock')
    expect(styles).toBe('Psychedelic Rock, Classic Rock')
    expect(tracklist).toHaveLength(2)
    expect(tracklist[0]).toMatchObject({ position: 'A1', title: 'Come Together', duration: '4:20' })
  })

  it('returns nulls and empty tracklist on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const { tracklist, sortName, genres, styles } = await fetchVinylRelease('99999')
    expect(tracklist).toEqual([])
    expect(sortName).toBeNull()
    expect(genres).toBeNull()
    expect(styles).toBeNull()
  })
})
