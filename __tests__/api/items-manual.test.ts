const mockUpload = jest.fn()
const mockStorageFrom = jest.fn(() => ({ upload: mockUpload }))
const mockDbFrom = jest.fn()
const mockDupeSingle = jest.fn()

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
  mockDupeSingle.mockReset()
  mockUpload.mockResolvedValue({ error: null })
  // Default: authenticated editor
  mockGetSession.mockResolvedValue({ role: 'editor' })
  // Default: no duplicate found
  mockDupeSingle.mockResolvedValue({ data: null })
  const dupeChain = { single: mockDupeSingle }
  const ilike2 = jest.fn().mockReturnValue(dupeChain)
  const ilike1 = jest.fn().mockReturnValue({ ilike: ilike2 })
  const eq2 = jest.fn().mockReturnValue({ ilike: ilike1 })
  const eq1 = jest.fn().mockReturnValue({ eq: eq2 })
  const dupeSelect = jest.fn().mockReturnValue({ eq: eq1 })
  // Also expose limit on dupeChain for chain: ilike → limit → single
  const limitFn = jest.fn().mockReturnValue(dupeChain)
  ilike2.mockReturnValue({ limit: limitFn })
  mockDbFrom.mockReturnValue({ select: dupeSelect })
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

describe('POST /api/items/manual — duplicate detection', () => {
  const EXISTING = { id: 'existing-uuid', title: 'Handmade', creator: '', year: null }

  it('returns 409 with existing item when duplicate title+creator found', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockDupeSingle.mockResolvedValue({ data: EXISTING })
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Handmade' })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Duplicate')
    expect(body.existing.id).toBe('existing-uuid')
    expect(mockCreateItem).not.toHaveBeenCalled()
  })

  it('bypasses duplicate check and creates item when force=true', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockDupeSingle.mockResolvedValue({ data: EXISTING })
    mockCreateItem.mockResolvedValue(ITEM)
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Handmade', force: 'true' })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCreateItem).toHaveBeenCalled()
  })

  it('proceeds normally (201) when no duplicate exists', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    // mockDupeSingle already returns { data: null } by default
    mockCreateItem.mockResolvedValue(ITEM)
    const req = makeFormRequest({ memberSlug: 'alice', collection: 'vinyl', title: 'Brand New' })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
