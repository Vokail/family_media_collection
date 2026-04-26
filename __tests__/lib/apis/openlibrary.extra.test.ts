import { fetchBookDescription } from '@/lib/apis/openlibrary'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

beforeEach(() => mockFetch.mockReset())

describe('fetchBookDescription', () => {
  it('returns null when externalId is isbn: format and no sources have a description', async () => {
    // Google Books: no items; OL ISBN search: no works key found
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })  // Google Books: no items
      .mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [] }) })  // OL ISBN search: no results
    const result = await fetchBookDescription('isbn:9780441013593')
    expect(result).toBeNull()
  })

  it('returns a plain string description', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ description: 'A great book.' }),
    })
    const result = await fetchBookDescription('/works/OL1234W')
    expect(result).toBe('A great book.')
  })

  it('returns description.value when description is an object', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ description: { type: '/type/text', value: 'Object description.' } }),
    })
    const result = await fetchBookDescription('/works/OL1234W')
    expect(result).toBe('Object description.')
  })

  it('returns null on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await fetchBookDescription('/works/OL1234W')
    expect(result).toBeNull()
  })

  it('returns null when description field is missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    const result = await fetchBookDescription('/works/OL1234W')
    expect(result).toBeNull()
  })
})

describe('kbSruByISBN (via lookupBookByISBN fallback)', () => {
  it('parses XML and extracts title, creator, and year', async () => {
    // Simulate all other racers failing so KB SRU wins
    const { lookupBookByISBN } = await import('@/lib/apis/openlibrary')

    // 4 racers: olSearch, olBibKeys, google, kbSru — make first three fail
    mockFetch
      .mockResolvedValueOnce({ ok: false })          // olSearchByISBN fails
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })  // olBibKeysByISBN: no data
      .mockResolvedValueOnce({ ok: false })          // googleBooksByISBN fails
      .mockResolvedValueOnce({                       // kbSruByISBN succeeds
        ok: true,
        text: async () => `
          <srw:numberOfRecords>1</srw:numberOfRecords>
          <dc:title>De Avonturen</dc:title>
          <dc:creator>Jan Jansen</dc:creator>
          <dc:date>1999</dc:date>
        `,
      })

    const result = await lookupBookByISBN('9789078345473')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('De Avonturen')
    expect(result!.creator).toBe('Jan Jansen')
    expect(result!.year).toBe(1999)
    expect(result!.cover_url).toBeNull()
  })
})

describe('googleBooksByISBN (source field and https upgrade)', () => {
  it('upgrades http cover thumbnail to https', async () => {
    const { lookupBookByISBN } = await import('@/lib/apis/openlibrary')

    mockFetch
      .mockResolvedValueOnce({ ok: false })          // olSearchByISBN fails
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })  // olBibKeysByISBN: empty
      .mockResolvedValueOnce({                       // googleBooksByISBN wins
        ok: true,
        json: async () => ({
          items: [{
            volumeInfo: {
              title: 'Test Book',
              authors: ['Author Name'],
              publishedDate: '2000',
              imageLinks: { thumbnail: 'http://books.google.com/thumb.jpg' },
            },
          }],
        }),
      })
      .mockResolvedValueOnce({ ok: false })          // kbSruByISBN fails (already resolved)

    const result = await lookupBookByISBN('0000000001')
    expect(result?.cover_url).toMatch(/^https:/)
    expect(result?.source).toBe('google')
  })
})

describe('fetchBookDescription Dutch language fallback', () => {
  // For Dutch books, the priority is:
  //   1. isbn + langRestrict=nl (Dutch description for this edition)
  //   2. title/author + langRestrict=nl (Dutch description by text search)
  //   3. OL works description (English fallback)
  // An English isbn result from Google Books is intentionally skipped so
  // we always try to get a Dutch description first.

  it('uses isbn+langRestrict=nl when Dutch isbn has Dutch description in Google Books', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ volumeInfo: { description: 'Nederlandse beschrijving van het isbn.' } }] }),
    })

    const result = await fetchBookDescription('isbn:9789021615417', '9789021615417', 'dutch', 'De Kleine Prins', 'Antoine de Saint-Exupéry')
    expect(result).toBe('Nederlandse beschrijving van het isbn.')

    const urls = (mockFetch.mock.calls as [string][]).map(([url]) => url)
    expect(urls[0]).toContain('langRestrict=nl')
    expect(urls[0]).toContain('isbn%3A')  // isbn: is encoded in the query
  })

  it('falls back to title/author+langRestrict=nl when isbn not in Google Books', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })       // isbn+langRestrict=nl: no items
      .mockResolvedValueOnce({                                            // title/author+langRestrict=nl: wins
        ok: true,
        json: async () => ({ items: [{ volumeInfo: { description: 'Een prachtig verhaal over vriendschap.' } }] }),
      })

    const result = await fetchBookDescription('isbn:9789021615417', '9789021615417', 'dutch', 'De Kleine Prins', 'Antoine de Saint-Exupéry')
    expect(result).toBe('Een prachtig verhaal over vriendschap.')

    const urls = (mockFetch.mock.calls as [string][]).map(([url]) => url)
    expect(urls[1]).toContain('langRestrict=nl')
    expect(urls[1]).toContain('intitle%3A')
  })

  it('does NOT return an English isbn result when Dutch; tries title/author first', async () => {
    // isbn in Google Books but only English description → skip it, try Dutch title/author
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })       // isbn+langRestrict=nl: no Dutch match
      .mockResolvedValueOnce({                                            // title/author+langRestrict=nl: Dutch wins
        ok: true,
        json: async () => ({ items: [{ volumeInfo: { description: 'Nederlandse beschrijving via titel.' } }] }),
      })

    const result = await fetchBookDescription('isbn:9789021615417', '9789021615417', 'dutch', 'De Kleine Prins', 'Antoine de Saint-Exupéry')
    expect(result).toBe('Nederlandse beschrijving via titel.')
    // Only 2 fetch calls — no unrestricted isbn call in between
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('falls back to OL when both Dutch Google Books searches return nothing', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })       // isbn+langRestrict=nl: nothing
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })       // title/author intitle+inauthor+langRestrict=nl: nothing
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })       // plain title+author+langRestrict=nl: nothing
      .mockResolvedValueOnce({                                            // OL isbn→workId lookup
        ok: true,
        json: async () => ({ docs: [{ key: '/works/OL123W' }] }),
      })
      .mockResolvedValueOnce({                                            // OL works description
        ok: true,
        json: async () => ({ description: 'English description from OL.' }),
      })

    const result = await fetchBookDescription('isbn:9789021615417', '9789021615417', 'dutch', 'De Kleine Prins', 'Antoine de Saint-Exupéry')
    expect(result).toBe('English description from OL.')
  })

  it('does not call Google Books at all when lang is not set', async () => {
    // Only OL works fetch should be called — no Google Books calls
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ description: 'Sci-fi epic.' }),
    })

    const result = await fetchBookDescription('/works/OL1234W', null, null, 'Dune', 'Frank Herbert')
    expect(result).toBe('Sci-fi epic.')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe('lookupBookByISBN with lang=dutch', () => {
  it('skips olSearchByISBN and uses KB SRU when lang is dutch', async () => {
    const { lookupBookByISBN } = await import('@/lib/apis/openlibrary')

    // Dutch path: 3 racers (kbSru, olBibKeys, google) — no olSearch
    mockFetch
      .mockResolvedValueOnce({                       // kbSruByISBN wins
        ok: true,
        text: async () => `
          <srw:numberOfRecords>1</srw:numberOfRecords>
          <dc:title>De Kleine Prins</dc:title>
          <dc:creator>Antoine de Saint-Exupéry</dc:creator>
          <dc:date>1966</dc:date>
        `,
      })
      .mockResolvedValueOnce({ ok: false })          // olBibKeysByISBN
      .mockResolvedValueOnce({ ok: false })          // googleBooksByISBN

    const result = await lookupBookByISBN('9789021615417', 'dutch')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('De Kleine Prins')
    // olSearchByISBN must NOT have been called (only 3 fetch calls for 3 racers)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('falls back to edition-level sources when KB SRU fails', async () => {
    const { lookupBookByISBN } = await import('@/lib/apis/openlibrary')

    mockFetch
      .mockResolvedValueOnce({ ok: false })          // kbSruByISBN fails
      .mockResolvedValueOnce({                       // olBibKeysByISBN succeeds
        ok: true,
        json: async () => ({
          'ISBN:9789021615417': {
            title: 'De Kleine Prins',
            authors: [{ name: 'Antoine de Saint-Exupéry' }],
            publish_date: '1966',
            cover: {},
          },
        }),
      })
      .mockResolvedValueOnce({ ok: false })          // googleBooksByISBN

    const result = await lookupBookByISBN('9789021615417', 'dutch')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('De Kleine Prins')
  })
})
