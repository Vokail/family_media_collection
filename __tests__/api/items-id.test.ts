const mockStorageRemove = jest.fn().mockResolvedValue({ error: null })
const mockStorageFrom = jest.fn().mockReturnValue({ remove: mockStorageRemove })
const mockSingle = jest.fn()
const mockEq = jest.fn()
const mockSelect = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  })),
}))
jest.mock('@/lib/db/items', () => ({
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
}))

import { PATCH, DELETE } from '@/app/api/items/[id]/route'
import { updateItem, deleteItem } from '@/lib/db/items'

const mockUpdateItem = updateItem as jest.Mock
const mockDeleteItem = deleteItem as jest.Mock

const ITEM = {
  id: 'item-uuid', title: 'Abbey Road', creator: 'The Beatles',
  is_wishlist: false, notes: null, cover_path: null,
}

function buildParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  mockUpdateItem.mockReset()
  mockDeleteItem.mockReset()
  mockStorageRemove.mockReset()
  mockStorageRemove.mockResolvedValue({ error: null })

  mockSingle.mockResolvedValue({ data: null, error: null })
  mockEq.mockReturnValue({ single: mockSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect, update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({}) }) })
})

describe('PATCH /api/items/[id]', () => {
  it('updates allowed fields and returns the item', async () => {
    const updated = { ...ITEM, is_wishlist: true }
    mockUpdateItem.mockResolvedValue(updated)
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_wishlist: true }),
    })
    const res = await PATCH(req, buildParams('item-uuid'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.is_wishlist).toBe(true)
    expect(mockUpdateItem).toHaveBeenCalledWith('item-uuid', { is_wishlist: true })
  })

  it('ignores keys not in the allowlist', async () => {
    mockUpdateItem.mockResolvedValue(ITEM)
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_wishlist: false, member_id: 'evil', title: 'Hacked' }),
    })
    await PATCH(req, buildParams('item-uuid'))
    const [, patch] = mockUpdateItem.mock.calls[0]
    expect(patch).not.toHaveProperty('member_id')
    expect(patch).not.toHaveProperty('title')
    expect(patch).toHaveProperty('is_wishlist')
  })
})

describe('DELETE /api/items/[id]', () => {
  it('deletes the item and returns ok when no cover', async () => {
    mockSingle.mockResolvedValue({ data: { cover_path: null }, error: null })
    mockDeleteItem.mockResolvedValue(undefined)

    const req = new Request('http://localhost/api/items/item-uuid', { method: 'DELETE' })
    const res = await DELETE(req, buildParams('item-uuid'))
    expect(res.status).toBe(200)
    expect(mockDeleteItem).toHaveBeenCalledWith('item-uuid')
    expect(mockStorageRemove).not.toHaveBeenCalled()
  })

  it('also removes the cover from storage when cover_path exists', async () => {
    mockSingle.mockResolvedValue({ data: { cover_path: 'covers/member-id/file.jpg' }, error: null })
    mockDeleteItem.mockResolvedValue(undefined)

    const req = new Request('http://localhost/api/items/item-uuid', { method: 'DELETE' })
    await DELETE(req, buildParams('item-uuid'))
    expect(mockStorageRemove).toHaveBeenCalledWith(['member-id/file.jpg'])
  })
})
