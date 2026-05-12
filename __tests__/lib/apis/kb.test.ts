import { kbSruByISBN } from '@/lib/apis/kb'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

beforeEach(() => mockFetch.mockReset())

const VALID_XML = `
  <srw:numberOfRecords>1</srw:numberOfRecords>
  <dc:title>De Kleine Prins</dc:title>
  <dc:creator>Antoine de Saint-Exupéry</dc:creator>
  <dc:date>1966</dc:date>
`

describe('kbSruByISBN', () => {
  it('throws when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    await expect(kbSruByISBN('9789021615417')).rejects.toThrow('not found')
  })

  it('throws when numberOfRecords is 0', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<srw:numberOfRecords>0</srw:numberOfRecords>',
    })
    await expect(kbSruByISBN('9789021615417')).rejects.toThrow('not found')
  })

  it('throws when numberOfRecords element is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<srw:records></srw:records>',
    })
    await expect(kbSruByISBN('9789021615417')).rejects.toThrow('not found')
  })

  it('throws when title element is missing even if count > 0', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `
        <srw:numberOfRecords>1</srw:numberOfRecords>
        <dc:creator>Some Author</dc:creator>
      `,
    })
    await expect(kbSruByISBN('9789021615417')).rejects.toThrow('not found')
  })

  it('returns a well-formed SearchResult with source "kb"', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => VALID_XML })
    const result = await kbSruByISBN('9789021615417')
    expect(result).toMatchObject({
      external_id: 'isbn:9789021615417',
      isbn: '9789021615417',
      title: 'De Kleine Prins',
      creator: 'Antoine de Saint-Exupéry',
      year: 1966,
      cover_url: null,
      source: 'kb',
    })
  })

  it('always returns cover_url as null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => VALID_XML })
    expect((await kbSruByISBN('9789021615417')).cover_url).toBeNull()
  })

  it('sets creator to "Unknown" when dc:creator is absent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `
        <srw:numberOfRecords>1</srw:numberOfRecords>
        <dc:title>Anoniem Werk</dc:title>
      `,
    })
    expect((await kbSruByISBN('9789000000000')).creator).toBe('Unknown')
  })

  it('sets year to null when dc:date is absent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `
        <srw:numberOfRecords>1</srw:numberOfRecords>
        <dc:title>Undated</dc:title>
        <dc:creator>Some Author</dc:creator>
      `,
    })
    expect((await kbSruByISBN('9789000000001')).year).toBeNull()
  })

  it('builds the URL with the KB SRU endpoint and ISBN', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    await kbSruByISBN('9789021615417').catch(() => {})
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('jsru.kb.nl/sru/sru')
    expect(url).toContain('9789021615417')
    expect(url).toContain('recordSchema=dc')
  })

  it('handles dc: elements with XML attributes in the opening tag', async () => {
    // The regex uses [^>]* to skip attributes — verify it still extracts content
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `
        <srw:numberOfRecords>1</srw:numberOfRecords>
        <dc:title xml:lang="nl">Geboortejaar</dc:title>
        <dc:creator>Bekende Auteur</dc:creator>
        <dc:date>2005</dc:date>
      `,
    })
    const result = await kbSruByISBN('9789000000002')
    expect(result.title).toBe('Geboortejaar')
    expect(result.year).toBe(2005)
  })
})
