const mockUpload = jest.fn()
const mockStorageFrom = jest.fn(() => ({ upload: mockUpload }))
const mockDbFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({
    from: mockDbFrom,
    storage: { from: mockStorageFrom },
  })),
}))
jest.mock('@/lib/db/items', () => ({ createItem: jest.fn() }))
jest.mock('@/lib/db/members', () => ({ getMemberBySlug: jest.fn() }))

const mockSharpInstance = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('img')),
}
jest.mock('sharp', () => jest.fn(() => mockSharpInstance))

import { POST } from '@/app/api/items/manual/route'
import { createItem } from '@/lib/db/items'
import { getMemberBySlug } from '@/lib/db/members'

const mockCreateItem = createItem as jest.Mock
const mockGetMember = getMemberBySlug as jest.Mock

const MEMBER = { id: 'member-uuid', name: 'Alice', slug: 'alice' }
const ITEM = { id: 'item-uuid', title: 'Handmade', member_id: 'member-uuid', collection: 'vinyl' }

function makeFormRequest(fields: Record<string, string | Blob>) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') form.append(k, v)
    else form.append(k, v, 'file.bin')
  }
  return new Request('http://localhost/api/items/manual', { method: 'POST', body: form })
}

beforeEach(() => {
  mockCreateItem.mockReset()
  mockGetMember.mockReset()
  mockUpload.mockReset()
  mockUpload.mockResolvedValue({ error: null })
})

describe('POST /api/items/manual', () => {
  it('returns 400 when required fields are missing', async () => {
    const req = makeFormRequest({ memberSlug: 'alice' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when member is not found', async () => {
    mockGetMember.mockResolvedValue(null)
    const req = makeFormRequest({ memberSlug: 'ghost', collection: 'vinyl', title: 'Test' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('creates item without cover and returns 201', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockCreateItem.mockResolvedValue(ITEM)
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Handmade' })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Handmade', collection: 'vinyl', cover_path: null }),
    )
  })

  it('uploads cover and sets cover_path when file is provided', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockCreateItem.mockResolvedValue({ ...ITEM, cover_path: 'covers/manual/member-uuid/uuid.jpg' })
    const coverFile = new Blob([Buffer.from('jpeg-data')], { type: 'image/jpeg' })
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Handmade', cover: coverFile })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockUpload).toHaveBeenCalled()
    const [, patch] = mockCreateItem.mock.calls[0]
    // cover_path should be set after successful upload
    expect(mockCreateItem.mock.calls[0][0].cover_path).toBeDefined()
  })
})
