const mockSingle = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockSelect = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({ from: mockFrom })),
}))

import { listMembers, getMemberBySlug, listMemberItemCounts } from '@/lib/db/members'

const MEMBERS = [
  { id: 'uuid-1', name: 'Alice', slug: 'alice' },
  { id: 'uuid-2', name: 'Bob', slug: 'bob' },
]

beforeEach(() => {
  mockSingle.mockReset()
  mockEq.mockReset()
  mockOrder.mockReset()
  mockSelect.mockReset()
  mockFrom.mockReset()
})

describe('listMembers', () => {
  it('returns all members ordered by name', async () => {
    mockOrder.mockResolvedValue({ data: MEMBERS, error: null })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await listMembers()
    expect(result).toHaveLength(2)
    expect(mockOrder).toHaveBeenCalledWith('name')
  })

  it('throws on Supabase error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error('fetch failed') })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    await expect(listMembers()).rejects.toThrow('fetch failed')
  })
})

describe('getMemberBySlug', () => {
  it('returns a member when found', async () => {
    mockSingle.mockResolvedValue({ data: MEMBERS[0] })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await getMemberBySlug('alice')
    expect(result).toEqual(MEMBERS[0])
    expect(mockEq).toHaveBeenCalledWith('slug', 'alice')
  })

  it('returns null when member not found', async () => {
    mockSingle.mockResolvedValue({ data: null })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await getMemberBySlug('ghost')
    expect(result).toBeNull()
  })
})

describe('listMemberItemCounts', () => {
  it('groups item counts by member and collection', async () => {
    const rows = [
      { member_id: 'uuid-1', collection: 'vinyl' },
      { member_id: 'uuid-1', collection: 'vinyl' },
      { member_id: 'uuid-1', collection: 'book' },
      { member_id: 'uuid-2', collection: 'comic' },
    ]
    mockEq.mockResolvedValue({ data: rows })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await listMemberItemCounts()
    expect(result['uuid-1'].vinyl).toBe(2)
    expect(result['uuid-1'].book).toBe(1)
    expect(result['uuid-2'].comic).toBe(1)
    expect(result['uuid-2'].vinyl).toBeUndefined()
  })

  it('returns empty object when no items exist', async () => {
    mockEq.mockResolvedValue({ data: [] })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await listMemberItemCounts()
    expect(result).toEqual({})
  })

  it('handles null data from Supabase', async () => {
    mockEq.mockResolvedValue({ data: null })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await listMemberItemCounts()
    expect(result).toEqual({})
  })
})
