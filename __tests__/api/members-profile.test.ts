const mockStorageUpload = jest.fn()
const mockStorageFrom = jest.fn().mockReturnValue({ upload: mockStorageUpload })

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}))
jest.mock('@/lib/db/members', () => ({
  updateMemberCollections: jest.fn(),
  updateMemberAvatar: jest.fn(),
}))
jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({
    storage: { from: mockStorageFrom },
  })),
}))
jest.mock('sharp', () => {
  const chain = {
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('img')),
  }
  return jest.fn(() => chain)
})

import { PATCH, PUT } from '@/app/api/members/profile/route'
import { getSession } from '@/lib/session'
import { updateMemberCollections, updateMemberAvatar } from '@/lib/db/members'

const mockGetSession = getSession as jest.Mock
const mockUpdate = updateMemberCollections as jest.Mock
const mockUpdateAvatar = updateMemberAvatar as jest.Mock

function req(body: unknown) {
  return new Request('http://localhost/api/members/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function avatarReq(blob?: Blob) {
  const form = new FormData()
  if (blob) form.append('avatar', blob, 'photo.jpg')
  return new Request('http://localhost/api/members/profile', {
    method: 'PUT',
    body: form,
  })
}

beforeEach(() => {
  mockGetSession.mockReset()
  mockUpdate.mockReset()
  mockUpdateAvatar.mockReset()
  mockStorageUpload.mockReset()
  mockUpdate.mockResolvedValue(undefined)
  mockUpdateAvatar.mockResolvedValue(undefined)
  mockStorageUpload.mockResolvedValue({ error: null })
})

describe('PATCH /api/members/profile', () => {
  it('saves enabled collections for a member', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PATCH(req({ enabled_collections: ['vinyl', 'book'] }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('member-uuid', ['vinyl', 'book'])
  })

  it('returns 403 for viewer role', async () => {
    mockGetSession.mockResolvedValue({ role: 'viewer' })
    const res = await PATCH(req({ enabled_collections: ['vinyl'] }))
    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 403 for editor role', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    const res = await PATCH(req({ enabled_collections: ['vinyl'] }))
    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 when all collections are removed', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PATCH(req({ enabled_collections: [] }))
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid collection type', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PATCH(req({ enabled_collections: ['vinyl', 'movies'] }))
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 when enabled_collections is not an array', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PATCH(req({ enabled_collections: 'vinyl' }))
    expect(res.status).toBe(400)
  })

  it('accepts all four collections', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PATCH(req({ enabled_collections: ['vinyl', 'book', 'comic', 'lego'] }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('member-uuid', ['vinyl', 'book', 'comic', 'lego'])
  })
})

describe('PUT /api/members/profile (avatar upload)', () => {
  it('returns 403 for viewer role', async () => {
    mockGetSession.mockResolvedValue({ role: 'viewer' })
    const file = new Blob(['data'], { type: 'image/jpeg' })
    const res = await PUT(avatarReq(file))
    expect(res.status).toBe(403)
    expect(mockUpdateAvatar).not.toHaveBeenCalled()
  })

  it('returns 403 for editor role', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    const file = new Blob(['data'], { type: 'image/jpeg' })
    const res = await PUT(avatarReq(file))
    expect(res.status).toBe(403)
  })

  it('returns 400 when no file provided', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const res = await PUT(avatarReq())
    expect(res.status).toBe(400)
  })

  it('uploads avatar and updates member record', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const file = new Blob(['data'], { type: 'image/jpeg' })
    const res = await PUT(avatarReq(file))
    expect(res.status).toBe(200)
    expect(mockStorageFrom).toHaveBeenCalledWith('covers')
    expect(mockStorageUpload).toHaveBeenCalledWith(
      'avatars/member-uuid.jpg',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true }),
    )
    expect(mockUpdateAvatar).toHaveBeenCalledWith('member-uuid', 'avatars/member-uuid.jpg')
    const data = await res.json()
    expect(data.avatar_path).toBe('avatars/member-uuid.jpg')
  })

  it('returns 500 when storage upload fails', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    mockStorageUpload.mockResolvedValue({ error: { message: 'storage error' } })
    const file = new Blob(['data'], { type: 'image/jpeg' })
    const res = await PUT(avatarReq(file))
    expect(res.status).toBe(500)
    expect(mockUpdateAvatar).not.toHaveBeenCalled()
  })
})

describe('PUT /api/members/profile — file validation (#99)', () => {
  it('returns 400 for unsupported file type', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    const file = new Blob(['data'], { type: 'image/gif' })
    const res = await PUT(avatarReq(file))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Unsupported file type')
    expect(mockUpdateAvatar).not.toHaveBeenCalled()
  })

  it('returns 400 when file exceeds 10 MB', async () => {
    mockGetSession.mockResolvedValue({ role: 'member', editableMemberId: 'member-uuid' })
    // Use a fake request where formData() returns a File with a spoofed size,
    // bypassing FormData serialisation which can't handle a mismatched size getter
    const bigFile = { type: 'image/jpeg', size: 11 * 1024 * 1024 } as File
    const fakeReq = { formData: async () => ({ get: () => bigFile }) } as unknown as Request
    const res = await PUT(fakeReq)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/too large/i)
    expect(mockUpdateAvatar).not.toHaveBeenCalled()
  })
})
