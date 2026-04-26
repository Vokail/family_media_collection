const mockSingle = jest.fn()
const mockOrder = jest.fn()
const mockEqChain = jest.fn()
const mockSelect = jest.fn()
const mockInsert = jest.fn()
const mockUpdate = jest.fn()
const mockDelete = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({ from: mockFrom })),
}))

import { listItems, createItem, updateItem, deleteItem } from '@/lib/db/items'

const ITEM = {
  id: 'item-uuid', member_id: 'member-uuid', collection: 'vinyl' as const,
  title: 'Abbey Road', creator: 'The Beatles', year: 1969,
  cover_path: null, is_wishlist: false, notes: null, created_at: '2024-01-01',
  external_id: null, sort_name: null, tracklist: null, description: null, isbn: null,
}

beforeEach(() => {
  mockSingle.mockReset()
  mockOrder.mockReset()
  mockEqChain.mockReset()
  mockSelect.mockReset()
  mockInsert.mockReset()
  mockUpdate.mockReset()
  mockDelete.mockReset()
  mockFrom.mockReset()
})

describe('listItems', () => {
  it('returns items ordered by created_at descending', async () => {
    mockOrder.mockResolvedValue({ data: [ITEM], error: null })
    mockEqChain.mockReturnValue({ eq: mockEqChain, order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEqChain })
    mockFrom.mockReturnValue({ select: mockSelect })

    const items = await listItems('member-uuid', 'vinyl')
    expect(items).toHaveLength(1)
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('throws when Supabase returns an error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error('DB error') })
    mockEqChain.mockReturnValue({ eq: mockEqChain, order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEqChain })
    mockFrom.mockReturnValue({ select: mockSelect })

    await expect(listItems('member-uuid', 'vinyl')).rejects.toThrow('DB error')
  })
})

describe('createItem', () => {
  it('inserts and returns the created item', async () => {
    mockSingle.mockResolvedValue({ data: ITEM, error: null })
    const selectChain = { single: mockSingle }
    const insertChain = { select: jest.fn().mockReturnValue(selectChain) }
    mockInsert.mockReturnValue(insertChain)
    mockFrom.mockReturnValue({ insert: mockInsert })

    const result = await createItem({ ...ITEM, id: undefined as unknown as string, created_at: undefined as unknown as string })
    expect(result).toEqual(ITEM)
  })

  it('throws on insert error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error('insert failed') })
    const selectChain = { single: mockSingle }
    const insertChain = { select: jest.fn().mockReturnValue(selectChain) }
    mockInsert.mockReturnValue(insertChain)
    mockFrom.mockReturnValue({ insert: mockInsert })

    await expect(createItem({ ...ITEM } as Parameters<typeof createItem>[0])).rejects.toThrow('insert failed')
  })
})

describe('updateItem', () => {
  it('updates and returns the updated item', async () => {
    mockSingle.mockResolvedValue({ data: { ...ITEM, is_wishlist: true }, error: null })
    const eqChain = { select: jest.fn().mockReturnValue({ single: mockSingle }) }
    mockUpdate.mockReturnValue({ eq: jest.fn().mockReturnValue(eqChain) })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const result = await updateItem('item-uuid', { is_wishlist: true })
    expect(result.is_wishlist).toBe(true)
  })
})

describe('deleteItem', () => {
  it('calls delete with correct id', async () => {
    const mockDeleteEq = jest.fn().mockResolvedValue({ error: null })
    mockDelete.mockReturnValue({ eq: mockDeleteEq })
    mockFrom.mockReturnValue({ delete: mockDelete })

    await deleteItem('item-uuid')
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'item-uuid')
  })

  it('throws on delete error', async () => {
    const mockDeleteEq = jest.fn().mockResolvedValue({ error: new Error('delete failed') })
    mockDelete.mockReturnValue({ eq: mockDeleteEq })
    mockFrom.mockReturnValue({ delete: mockDelete })

    await expect(deleteItem('item-uuid')).rejects.toThrow('delete failed')
  })
})
