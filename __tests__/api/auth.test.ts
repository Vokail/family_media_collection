jest.mock('next/headers', () => ({
  headers: jest.fn(() => new Map([['x-forwarded-for', '1.2.3.4']])),
  cookies: jest.fn(() => ({ get: jest.fn(), set: jest.fn() })),
}))

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
  createSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  resolveRole: jest.fn(),
  seedCredentialsIfMissing: jest.fn(),
}))

jest.mock('@/lib/auth-lockout', () => ({
  checkLockout: jest.fn(),
  recordFailure: jest.fn(),
  clearAttempts: jest.fn(),
}))

import { POST, DELETE } from '@/app/api/auth/route'
import { getSession, createSession } from '@/lib/session'
import { resolveRole, seedCredentialsIfMissing } from '@/lib/auth'
import { checkLockout, recordFailure, clearAttempts } from '@/lib/auth-lockout'

const mockGetSession = getSession as jest.Mock
const mockCreateSession = createSession as jest.Mock
const mockResolveRole = resolveRole as jest.Mock
const mockSeedCreds = seedCredentialsIfMissing as jest.Mock
const mockCheckLockout = checkLockout as jest.Mock
const mockRecordFailure = recordFailure as jest.Mock
const mockClearAttempts = clearAttempts as jest.Mock

function makePostRequest(body: unknown) {
  return new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockGetSession.mockReset()
  mockCreateSession.mockReset()
  mockResolveRole.mockReset()
  mockSeedCreds.mockResolvedValue(undefined)
  mockCheckLockout.mockReturnValue({ locked: false, secondsLeft: 0 })
  mockRecordFailure.mockReturnValue(undefined)
  mockClearAttempts.mockReturnValue(undefined)
})

describe('POST /api/auth', () => {
  it('returns 429 when IP is locked out', async () => {
    mockCheckLockout.mockReturnValue({ locked: true, secondsLeft: 600 })
    const res = await POST(makePostRequest({ password: 'any' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/too many/i)
    expect(mockResolveRole).not.toHaveBeenCalled()
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/auth', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when password field is missing', async () => {
    const res = await POST(makePostRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 401 and records failure when password is wrong', async () => {
    mockResolveRole.mockResolvedValue(null)
    const res = await POST(makePostRequest({ password: 'wrong' }))
    expect(res.status).toBe(401)
    expect(mockRecordFailure).toHaveBeenCalled()
  })

  it('returns role and clears lockout on correct password', async () => {
    mockResolveRole.mockResolvedValue({ role: 'viewer' })
    mockCreateSession.mockResolvedValue(undefined)
    const res = await POST(makePostRequest({ password: '1234' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.role).toBe('viewer')
    expect(mockClearAttempts).toHaveBeenCalled()
    expect(mockCreateSession).toHaveBeenCalledWith('viewer', undefined)
  })
})

describe('DELETE /api/auth', () => {
  it('destroys the session and returns ok', async () => {
    const mockDestroy = jest.fn()
    mockGetSession.mockResolvedValue({ role: 'viewer', destroy: mockDestroy })

    const res = await DELETE()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(mockDestroy).toHaveBeenCalled()
  })
})
