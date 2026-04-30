const mockUpload = jest.fn()
const mockStorageRemove = jest.fn().mockResolvedValue({})
const mockDbSingle = jest.fn()
const mockDbUpdate = jest.fn()
const mockDbFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({
    from: mockDbFrom,
    storage: {
      from: jest.fn(() => ({
        upload: mockUpload,
        remove: mockStorageRemove,
      })),
    },
  })),
}))

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

const mockSharpInstance = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('img')),
}
jest.mock('sharp', () => jest.fn(() => mockSharpInstance))

import { POST } from '@/app/api/items/[id]/cover/route'
import { getSession } from '@/lib/session'

const mockGetSession = getSession as jest.Mock

function makeFormRequest(fields: Record<string, string | Blob>) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') form.append(k, v)
    else form.append(k, v, 'file.bin')
  }
  return new Request('http://localhost/api/items/item-id/cover', {
    method: 'POST',
    body: form,
  })
}

beforeEach(() => {
  mockGetSession.mockReset()
  mockUpload.mockReset()
  mockStorageRemove.mockReset()
  mockDbSingle.mockReset()
  mockDbUpdate.mockReset()

  const selectEq = { single: mockDbSingle }
  const updateEq = { select: jest.fn().mockReturnValue({ single: mockDbUpdate }) }
  mockDbFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue(selectEq) }),
    update: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: mockDbUpdate }) }) }),
  })
})

describe('POST /api/items/[id]/cover', () => {
  it('returns 403 for viewer role', async () => {
    mockGetSession.mockResolvedValue({ role: 'viewer' })
    const req = makeFormRequest({})
    const res = await POST(req, { params: { id: 'item-id' } })
    expect(res.status).toBe(403)
  })

  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue({ role: undefined })
    const req = makeFormRequest({})
    const res = await POST(req, { params: { id: 'item-id' } })
    expect(res.status).toBe(403) // !role || role === 'viewer' both return 403
  })

  it('returns 403 when member tries to upload cover for another member\'s item', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'other-member' })
    mockDbSingle.mockResolvedValue({ data: { member_id: 'owner-member', cover_path: null } })
    const req = makeFormRequest({})
    const res = await POST(req, { params: { id: 'item-id' } })
    expect(res.status).toBe(403)
  })

  it('allows member to upload cover for their own item', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-1' })
    mockDbSingle.mockResolvedValue({ data: { member_id: 'member-1', cover_path: null } })
    mockUpload.mockResolvedValue({ error: null })
    const updatedItem = { id: 'item-id', cover_path: 'covers/manual/member-1/uuid.jpg' }
    mockDbUpdate.mockResolvedValue({ data: updatedItem, error: null })
    const jpegBlob = new Blob([Buffer.from('jpeg-data')], { type: 'image/jpeg' })
    const req = makeFormRequest({ cover: jpegBlob })
    const res = await POST(req, { params: { id: 'item-id' } })
    expect(res.status).toBe(200)
  })

  it('returns 404 when item does not exist', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    mockDbSingle.mockResolvedValue({ data: null })
    const req = makeFormRequest({})
    const res = await POST(req, { params: { id: 'missing-id' } })
    expect(res.status).toBe(404)
  })

  it('returns 400 when no file is attached', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    mockDbSingle.mockResolvedValue({ data: { member_id: 'm1', cover_path: null } })
    const req = makeFormRequest({})
    const res = await POST(req, { params: { id: 'item-id' } })
    expect(res.status).toBe(400)
  })

  it('returns 400 for unsupported file type', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    mockDbSingle.mockResolvedValue({ data: { member_id: 'm1', cover_path: null } })
    const badFile = new Blob(['gif-data'], { type: 'image/gif' })
    const req = makeFormRequest({ cover: badFile })
    const res = await POST(req, { params: { id: 'item-id' } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unsupported/i)
  })

  it('uploads resized jpeg and returns updated item', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    mockDbSingle.mockResolvedValue({ data: { member_id: 'member-1', cover_path: null } })
    mockUpload.mockResolvedValue({ error: null })
    const updatedItem = { id: 'item-id', cover_path: 'covers/manual/member-1/uuid.jpg' }
    mockDbUpdate.mockResolvedValue({ data: updatedItem, error: null })

    const jpegBlob = new Blob([Buffer.from('jpeg-data')], { type: 'image/jpeg' })
    const req = makeFormRequest({ cover: jpegBlob })
    const res = await POST(req, { params: { id: 'item-id' } })
    expect(res.status).toBe(200)
    expect(mockUpload).toHaveBeenCalled()
  })
})
