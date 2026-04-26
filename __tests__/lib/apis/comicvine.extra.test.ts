import { lookupComicByBarcode } from '@/lib/apis/comicvine'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

beforeEach(() => mockFetch.mockReset())

describe('lookupComicByBarcode', () => {
  it('returns the first search result when comics are found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status_code: 1,
        results: [
          { id: 111, name: 'Watchmen', start_year: '1986', image: { medium_url: 'https://example.com/w.jpg' }, publisher: { name: 'DC Comics' } },
          { id: 222, name: 'Other', start_year: null, image: {}, publisher: null },
        ],
      }),
    })
    const result = await lookupComicByBarcode('1234567890')
    expect(result).not.toBeNull()
    expect(result!.external_id).toBe('111')
    expect(result!.title).toBe('Watchmen')
  })

  it('returns null when the search returns no results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status_code: 1, results: [] }),
    })
    const result = await lookupComicByBarcode('0000000000')
    expect(result).toBeNull()
  })

  it('returns null on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await lookupComicByBarcode('bad')
    expect(result).toBeNull()
  })
})
