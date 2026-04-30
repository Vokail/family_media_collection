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
jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

const mockSharpInstance = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('img')),
}
jest.mock('sharp', () => jest.fn(() => mockSharpInstance))

import { POST } from '@/app/api/items/manual/route'
import { createItem } from '@/lib/db/items'
import { getMemberBySlug } from '@/lib/db/members'
import { getSession } from '@/lib/session'

const mockCreateItem = createItem as jest.Mock
const mockGetMember = getMemberBySlug as jest.Mock
const mockGetSession = getSession as jest.Mock

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
  mockGetSession.mockReset()
  mockUpload.mockReset()
  mockUpload.mockResolvedValue({ error: null })
  // Default: authenticated editor
  mockGetSession.mockResolvedValue({ role: 'editor' })
})

describe('POST /api/items/manual — auth', () => {
  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue({ role: undefined })
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Test' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for viewer role', async () => {
    mockGetSession.mockResolvedValue({ role: 'viewer' })
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Test' })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 when member tries to add to another member\'s collection', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'other-uuid' })
    mockGetMember.mockResolvedValue(MEMBER) // MEMBER.id = 'member-uuid'
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Test' })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('allows member to add to their own collection', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    mockGetMember.mockResolvedValue(MEMBER)
    mockCreateItem.mockResolvedValue(ITEM)
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Test' })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe('POST /api/items/manual', () => {
  it('returns 400 when required fields are missing', async () => {
    const req = makeFormRequest({ memberSlug: 'alice' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid collection', async () => {
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'stamps', title: 'Test' })
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
    expect(mockCreateItem.mock.calls[0][0].cover_path).toBeDefined()
  })

  it('returns 500 when cover upload fails', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockUpload.mockResolvedValue({ error: new Error('storage error') })
    const coverFile = new Blob([Buffer.from('jpeg-data')], { type: 'image/jpeg' })
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Handmade', cover: coverFile })
    const res = await POST(req)
    expect(res.status).toBe(500)
    expect(mockCreateItem).not.toHaveBeenCalled()
  })

  it('returns 500 when DB throws', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockCreateItem.mockRejectedValue(new Error('db error'))
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Handmade' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
