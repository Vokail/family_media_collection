import { fetchVinylRelease } from '@/lib/apis/discogs'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

beforeEach(() => mockFetch.mockReset())

describe('fetchVinylRelease', () => {
  it('maps tracklist entries and returns sortName', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        artists_sort: 'Sinatra, Frank',
        tracklist: [
          { position: 'A1', title: 'My Way', duration: '4:35' },
          { position: 'A2', title: 'New York', duration: '' },
        ],
      }),
    })
    const result = await fetchVinylRelease('123456')
    expect(result.sortName).toBe('Sinatra, Frank')
    expect(result.tracklist).toHaveLength(2)
    expect(result.tracklist[0]).toEqual({ position: 'A1', title: 'My Way', duration: '4:35' })
    expect(result.tracklist[1].duration).toBeNull() // empty string → null
  })

  it('returns empty tracklist and null sortName on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await fetchVinylRelease('bad-id')
    expect(result).toEqual({ tracklist: [], sortName: null })
  })

  it('handles missing artists_sort gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tracklist: [] }),
    })
    const result = await fetchVinylRelease('456')
    expect(result.sortName).toBeNull()
    expect(result.tracklist).toEqual([])
  })
})

describe('parseDiscogsTitle (via searchVinyl)', () => {
  it('splits "Artist - Title" correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: 1, title: 'Pink Floyd - The Dark Side of the Moon', year: '1973', cover_image: null }],
      }),
    })
    const { searchVinyl } = await import('@/lib/apis/discogs')
    const results = await searchVinyl('dark side')
    expect(results[0].creator).toBe('Pink Floyd')
    expect(results[0].title).toBe('The Dark Side of the Moon')
  })

  it('preserves extra dashes in the title part', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: 2, title: 'Artist - Title - Subtitle', year: '1980', cover_image: null }],
      }),
    })
    const { searchVinyl } = await import('@/lib/apis/discogs')
    const results = await searchVinyl('query')
    expect(results[0].creator).toBe('Artist')
    expect(results[0].title).toBe('Title - Subtitle')
  })

  it('falls back to Unknown creator when no dash separator present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: 3, title: 'NoDashTitle', year: '1990', cover_image: null }],
      }),
    })
    const { searchVinyl } = await import('@/lib/apis/discogs')
    const results = await searchVinyl('query')
    expect(results[0].creator).toBe('Unknown')
    expect(results[0].title).toBe('NoDashTitle')
  })
})
