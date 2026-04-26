import { lookupComicByBarcode } from '@/lib/apis/comicvine'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

beforeEach(() => mockFetch.mockReset())

describe('lookupComicByBarcode', () => {
  it('returns the first search result when comics are found (non-numeric barcode)', async () => {
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
    const result = await lookupComicByBarcode('WATCHMEN-001')
    expect(result).not.toBeNull()
    expect(result!.external_id).toBe('111')
    expect(result!.title).toBe('Watchmen')
  })

  it('returns null when ISBN and ComicVine both return nothing', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false })  // olSearchByISBN
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })  // olBibKeysByISBN: empty
      .mockResolvedValueOnce({ ok: false })  // googleBooksByISBN
      .mockResolvedValueOnce({ ok: false })  // kbSruByISBN
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status_code: 1, results: [] }) })  // ComicVine: empty
    const result = await lookupComicByBarcode('0000000000000')
    expect(result).toBeNull()
  })

  it('returns null on fetch failure for non-numeric barcode', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await lookupComicByBarcode('BAD-BARCODE')
    expect(result).toBeNull()
  })
})
