jest.mock('@/lib/apis/openlibrary', () => ({ lookupBookByISBN: jest.fn() }))
jest.mock('@/lib/apis/discogs', () => ({ lookupVinylByBarcode: jest.fn() }))
jest.mock('@/lib/apis/comicvine', () => ({ lookupComicByBarcode: jest.fn() }))
jest.mock('@/lib/apis/rebrickable', () => ({ lookupLegoBySetNum: jest.fn() }))

import { GET } from '@/app/api/barcode/route'
import { lookupBookByISBN } from '@/lib/apis/openlibrary'
import { lookupVinylByBarcode } from '@/lib/apis/discogs'
import { lookupComicByBarcode } from '@/lib/apis/comicvine'
import { lookupLegoBySetNum } from '@/lib/apis/rebrickable'

const mockLookupBook = lookupBookByISBN as jest.Mock
const mockLookupVinyl = lookupVinylByBarcode as jest.Mock
const mockLookupComic = lookupComicByBarcode as jest.Mock
const mockLookupLego = lookupLegoBySetNum as jest.Mock

beforeEach(() => {
  mockLookupBook.mockReset()
  mockLookupVinyl.mockReset()
  mockLookupComic.mockReset()
  mockLookupLego.mockReset()
})

describe('GET /api/barcode', () => {
  it('returns 400 when code is missing', async () => {
    const req = new Request('http://localhost/api/barcode?type=book')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when type is missing', async () => {
    const req = new Request('http://localhost/api/barcode?code=9781234567890')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when lookup returns null', async () => {
    mockLookupBook.mockResolvedValue(null)
    const req = new Request('http://localhost/api/barcode?code=0000000000&type=book')
    const res = await GET(req)
    expect(res.status).toBe(404)
  })

  it('returns book result for type=book', async () => {
    const result = { external_id: '/works/OL1W', title: 'Dune', creator: 'Frank Herbert', year: 1965, cover_url: null, source: 'openlibrary' }
    mockLookupBook.mockResolvedValue(result)
    const req = new Request('http://localhost/api/barcode?code=9780441013593&type=book')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe('Dune')
    expect(mockLookupBook).toHaveBeenCalledWith('9780441013593', undefined)
  })

  it('returns vinyl result for type=vinyl', async () => {
    const result = { external_id: '1001', title: 'Abbey Road', creator: 'The Beatles', year: 1969, cover_url: null, source: 'discogs' }
    mockLookupVinyl.mockResolvedValue(result)
    const req = new Request('http://localhost/api/barcode?code=0724389862027&type=vinyl')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockLookupVinyl).toHaveBeenCalledWith('0724389862027')
  })

  it('returns lego result for type=lego', async () => {
    const result = { external_id: '75192-1', title: 'Millennium Falcon', creator: 'Star Wars', year: 2017, cover_url: null, source: 'rebrickable' }
    mockLookupLego.mockResolvedValue(result)
    const req = new Request('http://localhost/api/barcode?code=75192&type=lego')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockLookupLego).toHaveBeenCalledWith('75192')
  })
})
