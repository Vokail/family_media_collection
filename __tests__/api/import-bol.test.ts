jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))
jest.mock('@/lib/bol-import', () => ({ importBolWishlist: jest.fn() }))

import { POST } from '@/app/api/import/bol/route'
import { getSession } from '@/lib/session'
import { importBolWishlist } from '@/lib/bol-import'

const mockGetSession = getSession as jest.Mock
const mockImport = importBolWishlist as jest.Mock

const VALID_URL = 'https://www.bol.com/nl/nl/verlanglijstje/b35dd6d8-14de-4f93-a036-fb21ca06f180/'

beforeEach(() => {
  mockGetSession.mockReset()
  mockImport.mockReset()
})

describe('POST /api/import/bol', () => {
  it('returns 401 when session has no editableMemberId', async () => {
    mockGetSession.mockResolvedValue({ role: 'viewer' })
    const req = new Request('http://localhost/api/import/bol', {
      method: 'POST',
      body: JSON.stringify({ shareUrl: VALID_URL }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when shareUrl is missing', async () => {
    mockGetSession.mockResolvedValue({ editableMemberId: 'member-1' })
    const req = new Request('http://localhost/api/import/bol', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-Bol URL', async () => {
    mockGetSession.mockResolvedValue({ editableMemberId: 'member-1' })
    const req = new Request('http://localhost/api/import/bol', {
      method: 'POST',
      body: JSON.stringify({ shareUrl: 'https://example.com/wishlist' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for Bol URL without verlanglijstje', async () => {
    mockGetSession.mockResolvedValue({ editableMemberId: 'member-1' })
    const req = new Request('http://localhost/api/import/bol', {
      method: 'POST',
      body: JSON.stringify({ shareUrl: 'https://www.bol.com/nl/nl/p/hotel/123/' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns import result on success', async () => {
    mockGetSession.mockResolvedValue({ editableMemberId: 'member-1' })
    mockImport.mockResolvedValue({ imported: 2, skipped: [] })
    const req = new Request('http://localhost/api/import/bol', {
      method: 'POST',
      body: JSON.stringify({ shareUrl: VALID_URL }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.imported).toBe(2)
    expect(mockImport).toHaveBeenCalledWith(VALID_URL, 'member-1')
  })

  it('returns 500 on import error', async () => {
    mockGetSession.mockResolvedValue({ editableMemberId: 'member-1' })
    mockImport.mockRejectedValue(new Error('Fetch failed'))
    const req = new Request('http://localhost/api/import/bol', {
      method: 'POST',
      body: JSON.stringify({ shareUrl: VALID_URL }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Fetch failed')
  })
})
