import { searchBooks, searchOpenLibrary, lookupBookByISBN, cleanDescription } from '@/lib/apis/openlibrary'

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

  it('passes language=eng to OL when lang="english" — fixes Harry Potter Dutch results bug', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [] }) })
    await searchOpenLibrary('Harry Potter', 0, 'english')
    const url = mockFetch.mock.calls.at(-1)![0] as string
    expect(url).toMatch(/[?&]language=eng(\b|&)/)
  })

  it('passes language=dut to OL when lang="dutch"', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [] }) })
    await searchOpenLibrary('Warrior Cats', 0, 'dutch')
    const url = mockFetch.mock.calls.at(-1)![0] as string
    expect(url).toMatch(/[?&]language=dut(\b|&)/)
  })

  it('omits language filter when lang is undefined or "all"', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [] }) })
    await searchOpenLibrary('something', 0)
    const url1 = mockFetch.mock.calls.at(-1)![0] as string
    expect(url1).not.toContain('language=')

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [] }) })
    await searchOpenLibrary('something else', 0, 'all')
    const url2 = mockFetch.mock.calls.at(-1)![0] as string
    expect(url2).not.toContain('language=')
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

  it('passes language filter through to OL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [] }) })
    await searchBooks('Harry Potter', 'english')
    const url = mockFetch.mock.calls.at(-1)![0] as string
    expect(url).toMatch(/[?&]language=eng(\b|&)/)
  })
})

// Regression: making sure the search-side language filter doesn't leak into
// the barcode/ISBN flow. lookupBookByISBN intentionally does NOT filter by the
// search-page language picker — it relies on per-source language handling
// (KB for Dutch, Google Books langRestrict, edition fallback).
describe('lookupBookByISBN — barcode path is unaffected by search language filter', () => {
  beforeEach(() => mockFetch.mockClear())

  it('never appends &language= from the search-lang map (English)', async () => {
    // Make all 4 racers fail so the function exhausts every endpoint we want to inspect
    mockFetch.mockResolvedValue({ ok: false })
    await lookupBookByISBN('9780747532699', 'english')
    const allUrls = mockFetch.mock.calls.map(c => c[0] as string)
    expect(allUrls.length).toBeGreaterThan(0)
    for (const url of allUrls) {
      // None of the OL/Google/KB barcode lookups should carry our search-side filter
      expect(url).not.toMatch(/[?&]language=(eng|dut|fre|ger)(\b|&)/)
    }
  })

  it('never appends &language= for Dutch lookups either', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await lookupBookByISBN('9789055798278', 'dutch')
    const allUrls = mockFetch.mock.calls.map(c => c[0] as string)
    for (const url of allUrls) {
      expect(url).not.toMatch(/[?&]language=(eng|dut|fre|ger)(\b|&)/)
    }
  })

  it('hits ISBN-specific endpoints, not the free-text search endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await lookupBookByISBN('9780747532699', 'english')
    const allUrls = mockFetch.mock.calls.map(c => c[0] as string)
    // OL barcode lookups use ?isbn= or /api/books?bibkeys=ISBN: — never ?q=
    const olCalls = allUrls.filter(u => u.includes('openlibrary.org'))
    for (const url of olCalls) {
      // The text-search endpoint signature is `?q=...` — must not be used here
      expect(url).not.toMatch(/[?&]q=/)
    }
  })
})

describe('lookupBookByISBN', () => {
  it('returns a result for a valid ISBN', async () => {
    // 4 racers fire concurrently: olSearch, olBibKeys, google, kbSru (in order)
    // olBibKeys wins with a cover — no cover fallback fetch needed
    mockFetch
      .mockResolvedValueOnce({ ok: false })                          // olSearchByISBN fails
      .mockResolvedValueOnce({                                        // olBibKeysByISBN succeeds with cover
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
    expect(result!.cover_url).toContain('12345')
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

  it('patches cover from Google Books when winning source (e.g. KB) has no cover', async () => {
    // Dutch path: KB wins first (no cover), OL bibkeys and Google Books discarded in race
    // Then fetchCoverForISBN fires: olBibKeys (no cover) + Google Books (has cover)
    mockFetch
      .mockResolvedValueOnce({                                        // kbSruByISBN succeeds — no cover
        ok: true,
        text: async () => `<srw:numberOfRecords>1</srw:numberOfRecords>
          <dc:title>De wildernis in</dc:title>
          <dc:creator>Erin Hunter</dc:creator>`,
      })
      .mockResolvedValueOnce({ ok: false })                          // olBibKeysByISBN fails in race
      .mockResolvedValueOnce({ ok: false })                          // googleBooksByISBN fails in race
      // fetchCoverForISBN fires next (olBibKeys + Google Books in parallel)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })  // olBibKeys — no book entry
      .mockResolvedValueOnce({                                        // googleBooksByISBN — has cover
        ok: true,
        json: async () => ({
          items: [{ volumeInfo: {
            title: 'De wildernis in',
            authors: ['Erin Hunter'],
            publishedDate: '2003',
            imageLinks: { thumbnail: 'https://books.google.com/cover.jpg' },
          }}],
        }),
      })
    const result = await lookupBookByISBN('9789055798278', 'dutch')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('De wildernis in')
    expect(result!.source).toBe('kb')
    expect(result!.cover_url).toBe('https://books.google.com/cover.jpg')
  })

  it('returns null cover_url when no source has a cover', async () => {
    // Dutch path: KB wins, all cover fallback sources also fail
    mockFetch
      .mockResolvedValueOnce({                                        // kbSruByISBN — no cover
        ok: true,
        text: async () => `<srw:numberOfRecords>1</srw:numberOfRecords>
          <dc:title>Some Book</dc:title><dc:creator>Author</dc:creator>`,
      })
      .mockResolvedValueOnce({ ok: false })                          // olBibKeys fails in race
      .mockResolvedValueOnce({ ok: false })                          // Google Books fails in race
      // fetchCoverForISBN — both fail
      .mockResolvedValueOnce({ ok: false })                          // olBibKeys cover fetch fails
      .mockResolvedValueOnce({ ok: false })                          // Google Books cover fetch fails
    const result = await lookupBookByISBN('9789000000000', 'dutch')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Some Book')
    expect(result!.cover_url).toBeNull()
  })
})

describe('cleanDescription', () => {
  it('strips OL wiki links with slash path: [[/works/OL123W|Dune]] → Dune', () => {
    expect(cleanDescription('A novel [[/works/OL123W|Dune]] by Herbert.')).toBe('A novel Dune by Herbert.')
  })

  it('strips OL wiki links without slash: [[Dune|the book]] → the book', () => {
    expect(cleanDescription('Read [[Dune|the book]] today.')).toBe('Read the book today.')
  })

  it('removes bare OL wiki links: [[/works/OL123W]] → empty', () => {
    expect(cleanDescription('See [[/works/OL123W]] for details.')).toBe('See  for details.')
  })

  it('strips markdown inline links: [text](url) → text', () => {
    expect(cleanDescription('Read [The Hobbit](https://openlibrary.org/works/OL123W) first.')).toBe('Read The Hobbit first.')
  })

  it('strips markdown reference links: [text][1] → text', () => {
    expect(cleanDescription('See [The Two Towers][2] for more.')).toBe('See The Two Towers for more.')
  })

  it('removes markdown reference definitions: [1]: url lines', () => {
    const input = 'Good book.\n[1]: https://openlibrary.org/works/OL1W\n[2]: https://openlibrary.org/works/OL2W'
    expect(cleanDescription(input)).toBe('Good book.')
  })

  it('strips markdown bold: **text** → text', () => {
    expect(cleanDescription('**Contains**\nSome info.')).toBe('Contains\nSome info.')
  })

  it('strips markdown italic: *text* → text', () => {
    expect(cleanDescription('A *great* adventure.')).toBe('A great adventure.')
  })

  it('strips hyperlinks with label: [https://example.com Click here] → Click here', () => {
    expect(cleanDescription('[https://example.com Click here] for more.')).toBe('Click here for more.')
  })

  it('removes bare URL brackets: [https://example.com] → empty', () => {
    expect(cleanDescription('See [https://example.com] for info.')).toBe('See  for info.')
  })

  it('strips HTML tags from Google Books descriptions', () => {
    expect(cleanDescription('A <b>great</b> book.<br/>Really good.')).toBe('A  great  book. Really good.')
  })

  it('decodes common HTML entities', () => {
    expect(cleanDescription('Fish &amp; chips &quot;delicious&quot;')).toBe('Fish & chips "delicious"')
  })

  it('removes Source: lines', () => {
    expect(cleanDescription('Good story.\nSource: Wikipedia\nMore text.')).toBe('Good story.\n\nMore text.')
  })

  it('cuts everything from divider to end of string', () => {
    expect(cleanDescription('Part one.\n----------\nContains section.')).toBe('Part one.')
  })

  it('normalises Windows line endings before processing', () => {
    expect(cleanDescription('Line one.\r\nLine two.\r\n----------\r\nMetadata.')).toBe('Line one.\nLine two.')
  })

  it('handles real OL Contains section (LotR pattern)', () => {
    const input = 'An epic adventure.\n\n----------\n\n**Contains**\n\n - [The Fellowship of the Ring][1]\n\n  [1]: https://openlibrary.org/works/OL1W'
    expect(cleanDescription(input)).toBe('An epic adventure.')
  })

  it('collapses excessive blank lines', () => {
    expect(cleanDescription('Line one.\n\n\n\nLine two.')).toBe('Line one.\n\nLine two.')
  })
})
