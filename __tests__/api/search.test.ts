jest.mock('@/lib/apis/openlibrary', () => ({ searchBooks: jest.fn() }))
jest.mock('@/lib/apis/discogs', () => ({ searchVinyl: jest.fn() }))
jest.mock('@/lib/apis/comicvine', () => ({ searchComics: jest.fn() }))
jest.mock('@/lib/apis/rebrickable', () => ({ searchLego: jest.fn() }))

import { GET } from '@/app/api/search/route'
import { searchBooks } from '@/lib/apis/openlibrary'
import { searchVinyl } from '@/lib/apis/discogs'
import { searchComics } from '@/lib/apis/comicvine'
import { searchLego } from '@/lib/apis/rebrickable'

const mockSearchBooks = searchBooks as jest.Mock
const mockSearchVinyl = searchVinyl as jest.Mock
const mockSearchComics = searchComics as jest.Mock
const mockSearchLego = searchLego as jest.Mock

const BOOK_RESULT = { external_id: '/works/OL1W', title: 'Dune', creator: 'Frank Herbert', year: 1965, cover_url: null, source: 'openlibrary' as const }
const VINYL_RESULT = { external_id: '1001', title: 'Abbey Road', creator: 'The Beatles', year: 1969, cover_url: null, source: 'discogs' as const }
const COMIC_RESULT = { external_id: '5555', title: 'Watchmen', creator: 'DC Comics', year: 1986, cover_url: null, source: 'comicvine' as const }
const LEGO_RESULT = { external_id: '75192-1', title: 'Millennium Falcon', creator: 'Star Wars', year: 2017, cover_url: null, source: 'rebrickable' as const }

beforeEach(() => {
  mockSearchBooks.mockReset()
  mockSearchVinyl.mockReset()
  mockSearchComics.mockReset()
  mockSearchLego.mockReset()
})

describe('GET /api/search', () => {
  it('returns 400 when q is missing', async () => {
    const req = new Request('http://localhost/api/search?type=book')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when type is missing', async () => {
    const req = new Request('http://localhost/api/search?q=Dune')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('calls searchBooks for type=book', async () => {
    mockSearchBooks.mockResolvedValue([BOOK_RESULT])
    const req = new Request('http://localhost/api/search?q=Dune&type=book')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockSearchBooks).toHaveBeenCalled()
    const data = await res.json()
    expect(data[0].title).toBe('Dune')
  })

  it('calls searchVinyl for type=vinyl and returns { results, hasMore }', async () => {
    mockSearchVinyl.mockResolvedValue({ results: [VINYL_RESULT], hasMore: false })
    const req = new Request('http://localhost/api/search?q=Abbey&type=vinyl')
    const res = await GET(req)
    expect(mockSearchVinyl).toHaveBeenCalled()
    const data = await res.json()
    expect(data.results[0].title).toBe('Abbey Road')
    expect(data.hasMore).toBe(false)
  })

  it('passes hasMore=true through when Discogs has more pages', async () => {
    const manyResults = Array.from({ length: 16 }, (_, i) => ({ ...VINYL_RESULT, external_id: String(i), title: `Album ${i}` }))
    mockSearchVinyl.mockResolvedValue({ results: manyResults, hasMore: true })
    const req = new Request('http://localhost/api/search?q=Springsteen&type=vinyl')
    const res = await GET(req)
    const data = await res.json()
    expect(data.hasMore).toBe(true)
    expect(data.results).toHaveLength(16)
  })

  it('calls searchComics for type=comic', async () => {
    mockSearchComics.mockResolvedValue([COMIC_RESULT])
    const req = new Request('http://localhost/api/search?q=Watchmen&type=comic')
    await GET(req)
    expect(mockSearchComics).toHaveBeenCalled()
  })

  it('calls searchLego for type=lego and returns { results, hasMore }', async () => {
    mockSearchLego.mockResolvedValue({ results: [LEGO_RESULT], hasMore: false })
    const req = new Request('http://localhost/api/search?q=Falcon&type=lego')
    const res = await GET(req)
    expect(mockSearchLego).toHaveBeenCalled()
    const data = await res.json()
    expect(data.results[0].title).toBe('Millennium Falcon')
    expect(data.hasMore).toBe(false)
  })

  it('passes hasMore=true through when Rebrickable has more pages', async () => {
    const manyResults = Array.from({ length: 20 }, (_, i) => ({ ...LEGO_RESULT, external_id: `${i}-1`, title: `Set ${i}` }))
    mockSearchLego.mockResolvedValue({ results: manyResults, hasMore: true })
    const req = new Request('http://localhost/api/search?q=Star+Wars&type=lego')
    const res = await GET(req)
    const data = await res.json()
    expect(data.hasMore).toBe(true)
    expect(data.results).toHaveLength(20)
  })

  it('deduplicates results with the same external_id', async () => {
    const dupe = { ...BOOK_RESULT }
    mockSearchBooks.mockResolvedValue([BOOK_RESULT, dupe])
    const req = new Request('http://localhost/api/search?q=Dune&type=book')
    const res = await GET(req)
    const data = await res.json()
    expect(data).toHaveLength(1)
  })

  it('keeps multiple Lego sets with the same name but different external_ids (#116)', async () => {
    // Real case: Millennium Falcon appears across many years (75375, 75192, 75257 etc.)
    const falcon2017 = { ...LEGO_RESULT, external_id: '75192-1', year: 2017 }
    const falcon2019 = { ...LEGO_RESULT, external_id: '75257-1', year: 2019 }
    const falcon2024 = { ...LEGO_RESULT, external_id: '75375-1', year: 2024 }
    mockSearchLego.mockResolvedValue({ results: [falcon2017, falcon2019, falcon2024], hasMore: false })
    const req = new Request('http://localhost/api/search?q=Millennium+Falcon&type=lego')
    const res = await GET(req)
    const data = await res.json()
    expect(data.results).toHaveLength(3)
    expect(data.results.map((r: { external_id: string }) => r.external_id)).toEqual(['75192-1', '75257-1', '75375-1'])
  })

  it('still deduplicates Lego results that share the same external_id', async () => {
    const dupe = { ...LEGO_RESULT }
    mockSearchLego.mockResolvedValue({ results: [LEGO_RESULT, dupe], hasMore: false })
    const req = new Request('http://localhost/api/search?q=Falcon&type=lego')
    const res = await GET(req)
    const data = await res.json()
    expect(data.results).toHaveLength(1)
  })
})
