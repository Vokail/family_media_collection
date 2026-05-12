import { googleBooksDescription, googleBooksByISBN } from '@/lib/apis/google-books'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

beforeEach(() => mockFetch.mockReset())

describe('googleBooksDescription', () => {
  it('returns null on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    expect(await googleBooksDescription('Dune Frank Herbert')).toBeNull()
  })

  it('returns null when items array is missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    expect(await googleBooksDescription('Dune')).toBeNull()
  })

  it('returns null when volumeInfo has no description', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ volumeInfo: { title: 'Dune' } }] }),
    })
    expect(await googleBooksDescription('Dune')).toBeNull()
  })

  it('returns null when description is only whitespace', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ volumeInfo: { description: '   ' } }] }),
    })
    expect(await googleBooksDescription('Dune')).toBeNull()
  })

  it('returns the description after cleanDescription when present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ volumeInfo: { description: 'A <b>great</b> sci-fi epic.' } }],
      }),
    })
    const result = await googleBooksDescription('Dune')
    // cleanDescription strips HTML tags → spaces
    expect(result).toMatch(/great.*sci-fi epic/)
  })

  it('includes langRestrict param when provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await googleBooksDescription('De Kleine Prins', 'nl')
    expect(mockFetch.mock.calls[0][0]).toContain('langRestrict=nl')
  })

  it('omits langRestrict param when not provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await googleBooksDescription('Dune')
    expect(mockFetch.mock.calls[0][0]).not.toContain('langRestrict')
  })

  it('encodes the query and sets maxResults=1 in the URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await googleBooksDescription('Frank Herbert Dune')
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('q=Frank%20Herbert%20Dune')
    expect(url).toContain('maxResults=1')
  })
})

describe('googleBooksByISBN', () => {
  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    await expect(googleBooksByISBN('9780441013593')).rejects.toThrow('not found')
  })

  it('throws when items array is missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await expect(googleBooksByISBN('9780441013593')).rejects.toThrow('not found')
  })

  it('throws when items[0].volumeInfo is missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{}] }) })
    await expect(googleBooksByISBN('9780441013593')).rejects.toThrow('not found')
  })

  it('returns a well-formed SearchResult with source "google"', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{
          volumeInfo: {
            title: 'Dune',
            authors: ['Frank Herbert'],
            publishedDate: '1965',
            imageLinks: { thumbnail: 'https://books.google.com/thumb.jpg' },
          },
        }],
      }),
    })
    const result = await googleBooksByISBN('9780441013593')
    expect(result).toMatchObject({
      external_id: 'isbn:9780441013593',
      isbn: '9780441013593',
      title: 'Dune',
      creator: 'Frank Herbert',
      year: 1965,
      cover_url: 'https://books.google.com/thumb.jpg',
      source: 'google',
    })
  })

  it('upgrades http:// cover thumbnail to https://', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{
          volumeInfo: {
            title: 'Dune',
            authors: ['Frank Herbert'],
            publishedDate: '1965',
            imageLinks: { thumbnail: 'http://books.google.com/thumb.jpg' },
          },
        }],
      }),
    })
    const result = await googleBooksByISBN('9780441013593')
    expect(result.cover_url).toBe('https://books.google.com/thumb.jpg')
  })

  it('sets cover_url to null when imageLinks is absent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ volumeInfo: { title: 'Dune', authors: ['Frank Herbert'], publishedDate: '1965' } }],
      }),
    })
    expect((await googleBooksByISBN('9780441013593')).cover_url).toBeNull()
  })

  it('sets creator to "Unknown" when authors is absent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ volumeInfo: { title: 'Anonymous', publishedDate: '2000' } }] }),
    })
    expect((await googleBooksByISBN('9780000000000')).creator).toBe('Unknown')
  })

  it('sets year to null when publishedDate is absent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ volumeInfo: { title: 'Undated', authors: ['X'] } }] }),
    })
    expect((await googleBooksByISBN('9780000000001')).year).toBeNull()
  })

  it('builds the URL with isbn: prefix and maxResults=1', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    await googleBooksByISBN('9780441013593').catch(() => {})
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('q=isbn:9780441013593')
    expect(url).toContain('maxResults=1')
  })
})
