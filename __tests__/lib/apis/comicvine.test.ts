import { searchComics, lookupComicByBarcode, fetchComicDescription } from '@/lib/apis/comicvine'

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
  it('tries ISBN lookup first for 13-digit numeric barcodes', async () => {
    // lookupBookByISBN is dynamically imported inside lookupComicByBarcode.
    // Mock fetch so the OL bibkeys call returns a match.
    mockFetch
      .mockResolvedValueOnce({ ok: false })  // olSearchByISBN: fail
      .mockResolvedValueOnce({               // olBibKeysByISBN: match
        ok: true,
        json: async () => ({
          'ISBN:9784088749198': {
            title: 'One Piece Vol. 1',
            authors: [{ name: 'Eiichiro Oda' }],
            publish_date: '1997',
            cover: { large: 'https://covers.openlibrary.org/b/id/123-L.jpg' },
          },
        }),
      })
      .mockResolvedValueOnce({ ok: false })  // googleBooksByISBN: fail
      .mockResolvedValueOnce({ ok: false })  // kbSruByISBN: fail

    const result = await lookupComicByBarcode('9784088749198')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('One Piece Vol. 1')
  })

  it('passes lang to lookupBookByISBN for Dutch ISBNs', async () => {
    // Dutch path calls Promise.any([kbSruByISBN, olBibKeysByISBN, googleBooksByISBN]) — no olSearchByISBN.
    // The three fetches fire in declaration order (synchronous), so mock order matches.
    mockFetch
      .mockResolvedValueOnce({               // kbSruByISBN: success
        ok: true,
        text: async () => `<srw:numberOfRecords>1</srw:numberOfRecords><dc:title>Pokémon Vol. 1 (NL)</dc:title><dc:creator>Satoshi Tajiri</dc:creator><dc:date>2024</dc:date>`,
      })
      .mockResolvedValueOnce({ ok: false })  // olBibKeysByISBN: fail (Promise.any ignores)
      .mockResolvedValueOnce({ ok: false })  // googleBooksByISBN: fail (Promise.any ignores)

    const result = await lookupComicByBarcode('9783989680081', 'dutch')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Pokémon Vol. 1 (NL)')
  })

  it('falls back to ComicVine text search when ISBN lookup returns null', async () => {
    // All ISBN sources fail → should call ComicVine search
    mockFetch
      .mockResolvedValueOnce({ ok: false })  // olSearchByISBN
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })  // olBibKeysByISBN: empty
      .mockResolvedValueOnce({ ok: false })  // googleBooksByISBN
      .mockResolvedValueOnce({ ok: false })  // kbSruByISBN
      .mockResolvedValueOnce({               // ComicVine search
        ok: true,
        json: async () => ({ status_code: 1, results: [{ id: 99, name: 'Manga Series', start_year: '2000', image: { medium_url: null }, publisher: null }] }),
      })

    const result = await lookupComicByBarcode('9784088749198')
    expect(result).not.toBeNull()
    expect(result!.external_id).toBe('99')
  })
})

describe('fetchComicDescription', () => {
  it('returns stripped description from ComicVine', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status_code: 1,
        results: { deck: null, description: '<p>A dark superhero story.</p><br/>' },
      }),
    })
    const result = await fetchComicDescription('5555')
    expect(result).toBe('A dark superhero story.')
  })

  it('prefers deck over description when both are present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status_code: 1,
        results: { deck: 'Short summary.', description: '<p>Long description.</p>' },
      }),
    })
    const result = await fetchComicDescription('5555')
    expect(result).toBe('Short summary.')
  })

  it('returns null when description is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status_code: 1, results: { deck: null, description: null } }),
    })
    const result = await fetchComicDescription('5555')
    expect(result).toBeNull()
  })

  it('returns null on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await fetchComicDescription('5555')
    expect(result).toBeNull()
  })
})
