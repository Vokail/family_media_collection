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
jest.mock('@/lib/session', () => ({
  getSession: jest.fn().mockResolvedValue({ role: 'editor' }),
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

  it('patches rating and passes it to updateItem', async () => {
    const updated = { ...ITEM, rating: 4 }
    mockUpdateItem.mockResolvedValue(updated)
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 4 }),
    })
    const res = await PATCH(req, buildParams('item-uuid'))
    expect(res.status).toBe(200)
    expect(mockUpdateItem).toHaveBeenCalledWith('item-uuid', { rating: 4 })
  })

  it('ignores keys not in the allowlist', async () => {
    mockUpdateItem.mockResolvedValue(ITEM)
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_wishlist: false, member_id: 'evil', collection: 'hacked' }),
    })
    await PATCH(req, buildParams('item-uuid'))
    const [, patch] = mockUpdateItem.mock.calls[0]
    expect(patch).not.toHaveProperty('member_id')
    expect(patch).not.toHaveProperty('collection')
    expect(patch).toHaveProperty('is_wishlist')
  })

  it('allows patching title, creator and year', async () => {
    mockUpdateItem.mockResolvedValue(ITEM)
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title', creator: 'New Artist', year: 1999 }),
    })
    await PATCH(req, buildParams('item-uuid'))
    const [, patch] = mockUpdateItem.mock.calls[0]
    expect(patch).toHaveProperty('title', 'New Title')
    expect(patch).toHaveProperty('creator', 'New Artist')
    expect(patch).toHaveProperty('year', 1999)
  })

  it('patches status to consumed and returns updated item', async () => {
    const updated = { ...ITEM, status: 'consumed' }
    mockUpdateItem.mockResolvedValue(updated)
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'consumed' }),
    })
    const res = await PATCH(req, buildParams('item-uuid'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('consumed')
    expect(mockUpdateItem).toHaveBeenCalledWith('item-uuid', { status: 'consumed' })
  })

  it('patches status to null (unread) and returns updated item', async () => {
    const updated = { ...ITEM, status: null }
    mockUpdateItem.mockResolvedValue(updated)
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: null }),
    })
    const res = await PATCH(req, buildParams('item-uuid'))
    expect(res.status).toBe(200)
    expect(mockUpdateItem).toHaveBeenCalledWith('item-uuid', { status: null })
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

  it('returns 500 when deleteItem throws', async () => {
    mockSingle.mockResolvedValue({ data: { cover_path: null }, error: null })
    mockDeleteItem.mockRejectedValue(new Error('db error'))

    const req = new Request('http://localhost/api/items/item-uuid', { method: 'DELETE' })
    const res = await DELETE(req, buildParams('item-uuid'))
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/items/[id] error handling', () => {
  it('returns 500 when updateItem throws', async () => {
    mockUpdateItem.mockRejectedValue(new Error('db error'))
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_wishlist: true }),
    })
    const res = await PATCH(req, buildParams('item-uuid'))
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/items/[id] locked_fields', () => {
  let mockUpdateFn: jest.Mock
  let mockUpdateEqFn: jest.Mock

  beforeEach(() => {
    mockUpdateEqFn = jest.fn().mockResolvedValue({})
    mockUpdateFn = jest.fn().mockReturnValue({ eq: mockUpdateEqFn })
    // Return item with no existing locked fields by default
    mockSingle.mockResolvedValue({ data: { member_id: 'member-uuid', locked_fields: null }, error: null })
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdateFn })
    mockUpdateItem.mockResolvedValue(ITEM)
  })

  it('adds title to locked_fields when title is patched', async () => {
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    })
    await PATCH(req, buildParams('item-uuid'))
    expect(mockUpdateFn).toHaveBeenCalledWith({ locked_fields: ['title'] })
  })

  it('adds creator and year to locked_fields when both are patched', async () => {
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator: 'New Artist', year: 2000 }),
    })
    await PATCH(req, buildParams('item-uuid'))
    const { locked_fields } = mockUpdateFn.mock.calls[0][0]
    expect(locked_fields).toEqual(expect.arrayContaining(['creator', 'year']))
    expect(locked_fields).toHaveLength(2)
  })

  it('merges new locks with existing locked_fields without duplicates', async () => {
    mockSingle.mockResolvedValue({ data: { member_id: 'member-uuid', locked_fields: ['title'] }, error: null })
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Same Title', creator: 'New Artist' }),
    })
    await PATCH(req, buildParams('item-uuid'))
    const { locked_fields } = mockUpdateFn.mock.calls[0][0]
    expect(locked_fields).toEqual(expect.arrayContaining(['title', 'creator']))
    expect(locked_fields).toHaveLength(2) // no duplicate 'title'
  })

  it('does NOT update locked_fields when only non-lockable fields are patched', async () => {
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'A note', rating: 4 }),
    })
    await PATCH(req, buildParams('item-uuid'))
    expect(mockUpdateFn).not.toHaveBeenCalled()
  })

  it('still returns the updated item even when locked_fields update runs', async () => {
    const updated = { ...ITEM, title: 'New Title' }
    mockUpdateItem.mockResolvedValue(updated)
    const req = new Request('http://localhost/api/items/item-uuid', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    })
    const res = await PATCH(req, buildParams('item-uuid'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe('New Title')
  })
})
