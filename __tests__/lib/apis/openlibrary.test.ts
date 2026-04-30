import { searchBooks, lookupBookByISBN } from '@/lib/apis/openlibrary'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

describe('searchBooks', () => {
  it('returns merged results from OpenLibrary and Google Books', async () => {
    // OL fires first in Promise.all, then GB
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          docs: [{
            key: '/works/OL1234W',
            title: 'Into the Wild',
            author_name: ['Erin Hunter'],
            first_publish_year: 2003,
            cover_i: 12345,
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{
            id: 'gbid1',
            volumeInfo: {
              title: 'Warrior cats / De wildernis in',
              authors: ['Erin Hunter'],
              publishedDate: '2006',
              imageLinks: { thumbnail: 'https://books.google.com/cover.jpg' },
              industryIdentifiers: [{ type: 'ISBN_13', identifier: '9789022323175' }],
            },
          }],
        }),
      })
    const results = await searchBooks('Warrior Cats De Wildernis In', 'dutch')
    // GB result comes first in merged output (prepended), OL second
    expect(results[0]).toMatchObject({ title: 'Warrior cats / De wildernis in', source: 'google' })
    expect(results[1]).toMatchObject({ title: 'Into the Wild', source: 'openlibrary' })
  })

  it('passes language filter to OpenLibrary when lang is set', async () => {
    mockFetch.mockReset()
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })
    await searchBooks('Warrior Cats', 'dutch')
    const olUrl: string = (mockFetch.mock.calls[0][0] as string)
    expect(olUrl).toContain('language=dut')
  })

  it('does not pass language filter when lang is all', async () => {
    mockFetch.mockReset()
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ docs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })
    await searchBooks('Dune', 'all')
    const olUrl: string = (mockFetch.mock.calls[0][0] as string)
    expect(olUrl).not.toContain('language=')
  })

  it('deduplicates results with the same title and creator', async () => {
    // OL first, GB second
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          docs: [{ key: '/works/OL1234W', title: 'Dune', author_name: ['Frank Herbert'], first_publish_year: 1965, cover_i: null }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 'gbid1', volumeInfo: { title: 'Dune', authors: ['Frank Herbert'], publishedDate: '1965', industryIdentifiers: [] } }],
        }),
      })
    const results = await searchBooks('Dune')
    expect(results).toHaveLength(1)
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
