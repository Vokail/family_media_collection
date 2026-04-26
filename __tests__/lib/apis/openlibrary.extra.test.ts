import { fetchBookDescription } from '@/lib/apis/openlibrary'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

beforeEach(() => mockFetch.mockReset())

describe('fetchBookDescription', () => {
  it('returns null when externalId does not start with /works/', async () => {
    const result = await fetchBookDescription('isbn:9780441013593')
    expect(result).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
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
