jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))
jest.mock('@/lib/db/members', () => ({ listMembers: jest.fn() }))

import { GET } from '@/app/api/members/route'
import { getSession } from '@/lib/session'
import { listMembers } from '@/lib/db/members'

const mockGetSession = getSession as jest.Mock
const mockListMembers = listMembers as jest.Mock

const MEMBERS = [
  { id: 'm1', name: 'Alice', slug: 'alice', enabled_collections: ['vinyl'] },
  { id: 'm2', name: 'Bob', slug: 'bob', enabled_collections: ['book'] },
]

beforeEach(() => {
  mockGetSession.mockReset()
  mockListMembers.mockReset()
})

describe('GET /api/members', () => {
  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue({ role: undefined })
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockListMembers).not.toHaveBeenCalled()
  })

  it('returns members list for viewer', async () => {
    mockGetSession.mockResolvedValue({ role: 'viewer' })
    mockListMembers.mockResolvedValue(MEMBERS)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
    expect(data[0].slug).toBe('alice')
  })

  it('returns members list for member role', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'm1' })
    mockListMembers.mockResolvedValue(MEMBERS)
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('returns members list for editor', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    mockListMembers.mockResolvedValue(MEMBERS)
    const res = await GET()
    expect(res.status).toBe(200)
  })
})
