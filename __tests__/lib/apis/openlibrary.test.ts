import { searchBooks, lookupBookByISBN } from '@/lib/apis/openlibrary'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

describe('searchBooks', () => {
  it('returns mapped results from OpenLibrary', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        docs: [{
          key: '/works/OL1234W',
          title: 'Dune',
          author_name: ['Frank Herbert'],
          first_publish_year: 1965,
          cover_i: 12345,
        }]
      })
    })
    const results = await searchBooks('Dune')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      external_id: '/works/OL1234W',
      title: 'Dune',
      creator: 'Frank Herbert',
      year: 1965,
      cover_url: 'https://covers.openlibrary.org/b/id/12345-L.jpg',
      source: 'openlibrary',
    })
  })

  it('returns empty array on fetch error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const results = await searchBooks('nothing')
    expect(results).toEqual([])
  })
})

describe('lookupBookByISBN', () => {
  it('returns a result for a valid ISBN', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'ISBN:9780441013593': {
          title: 'Dune',
          authors: [{ name: 'Frank Herbert' }],
          publish_date: '1965',
          cover: { large: 'https://covers.openlibrary.org/b/id/12345-L.jpg' },
        }
      })
    })
    const result = await lookupBookByISBN('9780441013593')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Dune')
  })

  it('returns null when ISBN not found', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    const result = await lookupBookByISBN('0000000000')
    expect(result).toBeNull()
  })
})
