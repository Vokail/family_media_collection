const mockSingle = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockSelect = jest.fn()
const mockUpdate = jest.fn()
const mockFrom = jest.fn()
const mockRpc = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}))

import { listMembers, getMemberBySlug, listMemberItemCounts, updateMemberCollections } from '@/lib/db/members'

const MEMBERS = [
  { id: 'uuid-1', name: 'Alice', slug: 'alice' },
  { id: 'uuid-2', name: 'Bob', slug: 'bob' },
]

beforeEach(() => {
  mockSingle.mockReset()
  mockEq.mockReset()
  mockOrder.mockReset()
  mockSelect.mockReset()
  mockUpdate.mockReset()
  mockFrom.mockReset()
  mockRpc.mockReset()
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
  it('maps aggregate rows to nested counts by member and collection', async () => {
    // The RPC returns one row per (member_id, collection) with a pre-computed count
    const rows = [
      { member_id: 'uuid-1', collection: 'vinyl', count: 2 },
      { member_id: 'uuid-1', collection: 'book', count: 1 },
      { member_id: 'uuid-2', collection: 'comic', count: 1 },
    ]
    mockRpc.mockResolvedValue({ data: rows })

    const result = await listMemberItemCounts()
    expect(result['uuid-1'].vinyl).toBe(2)
    expect(result['uuid-1'].book).toBe(1)
    expect(result['uuid-2'].comic).toBe(1)
    expect(result['uuid-2'].vinyl).toBeUndefined()
    expect(mockRpc).toHaveBeenCalledWith('get_member_item_counts')
  })

  it('returns empty object when no items exist', async () => {
    mockRpc.mockResolvedValue({ data: [] })

    const result = await listMemberItemCounts()
    expect(result).toEqual({})
  })

  it('handles null data from Supabase', async () => {
    mockRpc.mockResolvedValue({ data: null })

    const result = await listMemberItemCounts()
    expect(result).toEqual({})
  })
})

describe('updateMemberCollections', () => {
  it('updates enabled_collections for a member', async () => {
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    await updateMemberCollections('uuid-1', ['vinyl', 'book'])
    expect(mockUpdate).toHaveBeenCalledWith({ enabled_collections: ['vinyl', 'book'] })
    expect(mockEq).toHaveBeenCalledWith('id', 'uuid-1')
  })

  it('can set a single collection', async () => {
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    await updateMemberCollections('uuid-1', ['lego'])
    expect(mockUpdate).toHaveBeenCalledWith({ enabled_collections: ['lego'] })
  })
})
