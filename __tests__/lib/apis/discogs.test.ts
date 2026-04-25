import { searchVinyl, lookupVinylByBarcode } from '@/lib/apis/discogs'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

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
