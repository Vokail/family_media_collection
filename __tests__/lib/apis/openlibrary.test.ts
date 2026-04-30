import { searchBooks, searchOpenLibrary, lookupBookByISBN } from '@/lib/apis/openlibrary'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

describe('searchOpenLibrary (client-side, OL only)', () => {
  it('returns edition title when editions.docs has a match', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        docs: [{
          key: '/works/OL1234W',
          title: 'Into the Wild',
          author_name: ['Erin Hunter'],
          first_publish_year: 2003,
          cover_i: 12345,
          editions: { docs: [{ key: '/books/OL37843740M', title: 'De wildernis in', cover_i: 12727576 }] },
        }],
      }),
    })
    const results = await searchOpenLibrary('Warrior Cats De Wildernis In')
    expect(results[0]).toMatchObject({ title: 'De wildernis in', source: 'openlibrary' })
    expect(results[0].cover_url).toContain('12727576')
  })

  it('falls back to work title when no edition title is present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        docs: [{
          key: '/works/OL1234W',
          title: 'Dune',
          author_name: ['Frank Herbert'],
          first_publish_year: 1965,
          cover_i: 99999,
          editions: { docs: [] },
        }],
      }),
    })
    const results = await searchOpenLibrary('Dune')
    expect(results[0]).toMatchObject({ title: 'Dune', source: 'openlibrary' })
  })

  it('returns empty array on fetch error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const results = await searchOpenLibrary('nothing')
    expect(results).toEqual([])
  })
})

describe('searchBooks (server-side, used by /api/search)', () => {
  it('returns OL results with edition titles', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        docs: [{
          key: '/works/OL1234W',
          title: 'Dune',
          author_name: ['Frank Herbert'],
          first_publish_year: 1965,
          cover_i: null,
          editions: { docs: [] },
        }],
      }),
    })
    const results = await searchBooks('Dune')
    expect(results[0]).toMatchObject({ title: 'Dune', source: 'openlibrary' })
  })

  it('returns all OL docs (dedup happens in /api/search route)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        docs: [
          { key: '/works/OL1W', title: 'Dune', author_name: ['Frank Herbert'], first_publish_year: 1965, cover_i: null, editions: { docs: [] } },
          { key: '/works/OL2W', title: 'Dune', author_name: ['Frank Herbert'], first_publish_year: 1965, cover_i: null, editions: { docs: [] } },
        ],
      }),
    })
    const results = await searchBooks('Dune')
    expect(results).toHaveLength(2)
  })

  it('returns empty array on fetch error', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const results = await searchBooks('nothing')
    expect(results).toEqual([])
  })
})

describe('lookupBookByISBN', () => {
  it('returns a result for a valid ISBN', async () => {
    // 4 racers fire concurrently: olSearch, olBibKeys, google, kbSru (in order)
    mockFetch
      .mockResolvedValueOnce({ ok: false })                          // olSearchByISBN fails
      .mockResolvedValueOnce({                                        // olBibKeysByISBN succeeds
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
      .mockResolvedValueOnce({ ok: false })                          // googleBooksByISBN fails
      .mockResolvedValueOnce({ ok: false })                          // kbSruByISBN fails
    const result = await lookupBookByISBN('9780441013593')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Dune')
  })

  it('returns null when ISBN not found', async () => {
    // All 4 racers must fail for Promise.any to reject
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
    const result = await lookupBookByISBN('0000000000')
    expect(result).toBeNull()
  })
})
