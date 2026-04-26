import { searchComics, lookupComicByBarcode } from '@/lib/apis/comicvine'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

describe('searchComics', () => {
  it('returns mapped comic results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status_code: 1,
        results: [{
          id: 5555,
          name: 'Watchmen',
          start_year: '1986',
          image: { medium_url: 'https://example.com/watchmen.jpg' },
          publisher: { name: 'DC Comics' },
        }]
      })
    })
    const results = await searchComics('Watchmen')
    expect(results[0]).toMatchObject({
      external_id: '5555',
      title: 'Watchmen',
      creator: 'DC Comics',
      year: 1986,
      cover_url: 'https://example.com/watchmen.jpg',
      source: 'comicvine',
    })
  })

  it('returns empty array on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await searchComics('x')).toEqual([])
  })
})

describe('lookupComicByBarcode', () => {
  it('falls back to text search using barcode as query', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status_code: 1, results: [{ id: 1, name: 'Some Comic', start_year: '2000', image: null, publisher: null }] })
    })
    const result = await lookupComicByBarcode('9781401238964')
    expect(result).not.toBeNull()
  })
})
