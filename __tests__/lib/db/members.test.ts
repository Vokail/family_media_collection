const mockSingle = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockSelect = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({ from: mockFrom })),
}))

import { listMembers, getMemberBySlug } from '@/lib/db/members'

const MEMBERS = [
  { id: 'uuid-1', name: 'Ewart', slug: 'ewart' },
  { id: 'uuid-2', name: 'Marieke', slug: 'marieke' },
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

    const result = await getMemberBySlug('ewart')
    expect(result).toEqual(MEMBERS[0])
    expect(mockEq).toHaveBeenCalledWith('slug', 'ewart')
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
