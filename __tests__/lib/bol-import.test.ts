jest.mock('@/lib/db/items', () => ({
  listItems: jest.fn(),
  createItem: jest.fn(),
}))
jest.mock('@/lib/cover', () => ({ downloadCover: jest.fn() }))
jest.mock('@/lib/apis/discogs', () => ({
  lookupVinylByBarcode: jest.fn(),
  searchVinyl: jest.fn(),
}))
jest.mock('@/lib/apis/openlibrary', () => ({
  lookupBookByISBN: jest.fn(),
  searchBooks: jest.fn(),
}))

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

import { scrapeWishlist, scrapeProductDetail, importBolWishlist } from '@/lib/bol-import'
import { listItems, createItem } from '@/lib/db/items'
import { downloadCover } from '@/lib/cover'
import { lookupVinylByBarcode, searchVinyl } from '@/lib/apis/discogs'
import { lookupBookByISBN, searchBooks } from '@/lib/apis/openlibrary'

const mockListItems = listItems as jest.Mock
const mockCreateItem = createItem as jest.Mock
const mockDownloadCover = downloadCover as jest.Mock
const mockLookupVinyl = lookupVinylByBarcode as jest.Mock
const mockSearchVinyl = searchVinyl as jest.Mock
const mockLookupBook = lookupBookByISBN as jest.Mock
const mockSearchBooks = searchBooks as jest.Mock

const WISHLIST_HTML = `
<html><body>
<a href="/nl/nl/p/hotel-california/9200000035582688/" tabindex="-1">
  <img src="https://media.s-bol.com/ABC/168x176.jpg" alt="Hotel California (LP)">
</a>
<a href="/nl/nl/p/hotel-california/9200000035582688/">
  <span class="break-words">Hotel California (LP)</span>
</a>
</body></html>
`

const WISHLIST_HTML_TWO = `
<html><body>
<a href="/nl/nl/p/hotel-california/9200000035582688/"><span class="break-words">Hotel California (LP)</span></a>
<a href="/nl/nl/p/dune/9300000012345678/"><span class="break-words">Dune</span></a>
</body></html>
`

const VINYL_PRODUCT_HTML = `
<html><body>
<script type="application/ld+json">{"@type":"MusicAlbum","name":"Hotel California (LP)"}</script>
<script>{"@type":"PropertyValue","propertyID":"gtin13","value":"0081227961619"},{"@type":"PropertyValue","propertyID":"ean","value":"0081227961619"}</script>
</body></html>
`

const BOOK_PRODUCT_HTML = `
<html><body>
<script type="application/ld+json">{"@type":"Book","name":"Dune"}</script>
<script>{"@type":"PropertyValue","propertyID":"gtin13","value":"9780441013593"},{"@type":"PropertyValue","propertyID":"ean","value":"9780441013593"}</script>
</body></html>
`

const UNKNOWN_TYPE_HTML = `
<html><body>
<script type="application/ld+json">{"@type":"Game","name":"Some game"}</script>
</body></html>
`

const DISCOGS_RESULT = {
  external_id: '123',
  title: 'Hotel California',
  creator: 'Eagles',
  year: 1976,
  cover_url: 'https://img.discogs.com/hc.jpg',
  source: 'discogs' as const,
}

const OL_RESULT = {
  external_id: '/works/OL1W',
  title: 'Dune',
  creator: 'Frank Herbert',
  year: 1965,
  cover_url: 'https://covers.openlibrary.org/b/id/123-L.jpg',
  source: 'openlibrary' as const,
}

beforeEach(() => {
  mockFetch.mockReset()
  mockListItems.mockReset()
  mockCreateItem.mockReset()
  mockDownloadCover.mockReset()
  mockLookupVinyl.mockReset()
  mockSearchVinyl.mockReset()
  mockLookupBook.mockReset()
  mockSearchBooks.mockReset()
  mockCreateItem.mockResolvedValue({})
  mockDownloadCover.mockResolvedValue(null)
})

// ─── scrapeWishlist ──────────────────────────────────────────────────────────

describe('scrapeWishlist', () => {
  it('extracts product with full title from break-words span', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => WISHLIST_HTML })
    const items = await scrapeWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc/')
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Hotel California (LP)')
    expect(items[0].productId).toBe('9200000035582688')
    expect(items[0].productUrl).toContain('/9200000035582688/')
  })

  it('deduplicates products that appear multiple times', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => WISHLIST_HTML })
    const items = await scrapeWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc/')
    expect(items).toHaveLength(1)
  })

  it('extracts cover URL from media.s-bol.com', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => WISHLIST_HTML })
    const items = await scrapeWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc/')
    expect(items[0].bolCoverUrl).toMatch(/media\.s-bol\.com/)
  })

  it('handles URL without trailing slash', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => WISHLIST_HTML })
    await scrapeWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc')
    const calledUrl = (mockFetch.mock.calls[0][0] as string)
    expect(calledUrl.endsWith('/')).toBe(true)
  })

  it('throws when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(scrapeWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc/')).rejects.toThrow('404')
  })
})

// ─── scrapeProductDetail ─────────────────────────────────────────────────────

describe('scrapeProductDetail', () => {
  it('extracts EAN and MusicAlbum type', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => VINYL_PRODUCT_HTML })
    const detail = await scrapeProductDetail('https://www.bol.com/nl/nl/p/hotel-california/123/')
    expect(detail.eans).toContain('0081227961619')
    expect(detail.collectionType).toBe('vinyl')
  })

  it('extracts Book type', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => BOOK_PRODUCT_HTML })
    const detail = await scrapeProductDetail('https://www.bol.com/nl/nl/p/dune/123/')
    expect(detail.collectionType).toBe('book')
    expect(detail.eans).toContain('9780441013593')
  })

  it('returns null collectionType for unknown @type', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => UNKNOWN_TYPE_HTML })
    const detail = await scrapeProductDetail('https://www.bol.com/nl/nl/p/game/123/')
    expect(detail.collectionType).toBeNull()
  })

  it('deduplicates EANs', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => VINYL_PRODUCT_HTML })
    const detail = await scrapeProductDetail('https://www.bol.com/nl/nl/p/hotel-california/123/')
    const unique = new Set(detail.eans)
    expect(detail.eans.length).toBe(unique.size)
  })

  it('returns empty eans and null type on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    const detail = await scrapeProductDetail('https://www.bol.com/nl/nl/p/fail/123/')
    expect(detail.eans).toHaveLength(0)
    expect(detail.collectionType).toBeNull()
  })
})

// ─── importBolWishlist ───────────────────────────────────────────────────────

describe('importBolWishlist', () => {
  it('imports a vinyl item via EAN lookup', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WISHLIST_HTML })
      .mockResolvedValueOnce({ ok: true, text: async () => VINYL_PRODUCT_HTML })
    mockListItems.mockResolvedValue([])
    mockLookupVinyl.mockResolvedValue(DISCOGS_RESULT)
    mockDownloadCover.mockResolvedValue('covers/member-1/hc.jpg')

    const result = await importBolWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc/', 'member-1')

    expect(result.imported).toBe(1)
    expect(result.skipped).toHaveLength(0)
    expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'vinyl',
      is_wishlist: true,
      title: 'Hotel California',
      creator: 'Eagles',
    }))
  })

  it('imports a book item via ISBN lookup', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WISHLIST_HTML_TWO.replace(WISHLIST_HTML_TWO, `<html><body><a href="/nl/nl/p/dune/9300000012345678/"><span class="break-words">Dune</span></a></body></html>`) })
      .mockResolvedValueOnce({ ok: true, text: async () => BOOK_PRODUCT_HTML })
    mockListItems.mockResolvedValue([])
    mockLookupBook.mockResolvedValue(OL_RESULT)
    mockDownloadCover.mockResolvedValue('covers/member-1/dune.jpg')

    const result = await importBolWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc/', 'member-1')

    expect(result.imported).toBe(1)
    expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'book',
      title: 'Dune',
    }))
  })

  it('falls back to title search when EAN lookup returns null', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WISHLIST_HTML })
      .mockResolvedValueOnce({ ok: true, text: async () => VINYL_PRODUCT_HTML })
    mockListItems.mockResolvedValue([])
    mockLookupVinyl.mockResolvedValue(null)
    mockSearchVinyl.mockResolvedValue({ results: [DISCOGS_RESULT], hasMore: false })

    const result = await importBolWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc/', 'member-1')

    expect(result.imported).toBe(1)
    expect(mockSearchVinyl).toHaveBeenCalledWith('Hotel California (LP)')
  })

  it('skips item already in collection', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WISHLIST_HTML })
      .mockResolvedValueOnce({ ok: true, text: async () => VINYL_PRODUCT_HTML })
    mockListItems.mockResolvedValue([{ title: 'Hotel California (LP)', collection: 'vinyl', is_wishlist: false }])

    const result = await importBolWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc/', 'member-1')

    expect(result.imported).toBe(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toBe('already in collection')
    expect(mockCreateItem).not.toHaveBeenCalled()
  })

  it('skips item with unknown collection type', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WISHLIST_HTML })
      .mockResolvedValueOnce({ ok: true, text: async () => UNKNOWN_TYPE_HTML })
    mockListItems.mockResolvedValue([])

    const result = await importBolWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc/', 'member-1')

    expect(result.imported).toBe(0)
    expect(result.skipped[0].reason).toBe('unknown type')
  })

  it('uses Bol cover as fallback when API has no cover', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: async () => WISHLIST_HTML })
      .mockResolvedValueOnce({ ok: true, text: async () => VINYL_PRODUCT_HTML })
    mockListItems.mockResolvedValue([])
    mockLookupVinyl.mockResolvedValue({ ...DISCOGS_RESULT, cover_url: null })
    mockDownloadCover.mockResolvedValue('covers/member-1/bol.jpg')

    await importBolWishlist('https://www.bol.com/nl/nl/verlanglijstje/abc/', 'member-1')

    // Should call downloadCover with the Bol media URL (from WISHLIST_HTML)
    expect(mockDownloadCover).toHaveBeenCalledWith(
      expect.stringContaining('media.s-bol.com'),
      'member-1'
    )
  })
})
