jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}))
jest.mock('@/lib/db/members', () => ({
  updateMemberCollections: jest.fn(),
}))

import { PATCH } from '@/app/api/members/profile/route'
import { getSession } from '@/lib/session'
import { updateMemberCollections } from '@/lib/db/members'

const mockGetSession = getSession as jest.Mock
const mockUpdate = updateMemberCollections as jest.Mock

function req(body: unknown) {
  return new Request('http://localhost/api/members/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockGetSession.mockReset()
  mockUpdate.mockReset()
  mockUpdate.mockResolvedValue(undefined)
})

describe('PATCH /api/members/profile', () => {
  it('saves enabled collections for a member', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PATCH(req({ enabled_collections: ['vinyl', 'book'] }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('member-uuid', ['vinyl', 'book'])
  })

  it('returns 403 for viewer role', async () => {
    mockGetSession.mockResolvedValue({ role: 'viewer' })
    const res = await PATCH(req({ enabled_collections: ['vinyl'] }))
    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 403 for editor role', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    const res = await PATCH(req({ enabled_collections: ['vinyl'] }))
    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 when all collections are removed', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PATCH(req({ enabled_collections: [] }))
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid collection type', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PATCH(req({ enabled_collections: ['vinyl', 'movies'] }))
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 when enabled_collections is not an array', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PATCH(req({ enabled_collections: 'vinyl' }))
    expect(res.status).toBe(400)
  })

  it('accepts all four collections', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PATCH(req({ enabled_collections: ['vinyl', 'book', 'comic', 'lego'] }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('member-uuid', ['vinyl', 'book', 'comic', 'lego'])
  })
})
