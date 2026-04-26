jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ updateCredential: jest.fn() }))

import { PATCH } from '@/app/api/settings/route'
import { getSession } from '@/lib/session'
import { updateCredential } from '@/lib/auth'

const mockGetSession = getSession as jest.Mock
const mockUpdateCredential = updateCredential as jest.Mock

function makePatch(body: unknown) {
  return new Request('http://localhost/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockGetSession.mockReset()
  mockUpdateCredential.mockReset()
  mockUpdateCredential.mockResolvedValue(undefined)
})

describe('PATCH /api/settings', () => {
  it('returns 403 when role is viewer', async () => {
    mockGetSession.mockResolvedValue({ role: 'viewer' })
    const res = await PATCH(makePatch({ target: 'view_pin_hash', newValue: '9999' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for an invalid target', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    const res = await PATCH(makePatch({ target: 'evil_key', newValue: '1234' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when newValue is too short', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    const res = await PATCH(makePatch({ target: 'view_pin_hash', newValue: '12' }))
    expect(res.status).toBe(400)
  })

  it('updates view_pin_hash for an editor', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    const res = await PATCH(makePatch({ target: 'view_pin_hash', newValue: '5678' }))
    expect(res.status).toBe(200)
    expect(mockUpdateCredential).toHaveBeenCalledWith('view_pin_hash', '5678')
  })

  it('updates family_password_hash for an editor', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    const res = await PATCH(makePatch({ target: 'family_password_hash', newValue: 'newpass' }))
    expect(res.status).toBe(200)
    expect(mockUpdateCredential).toHaveBeenCalledWith('family_password_hash', 'newpass')
  })
})
