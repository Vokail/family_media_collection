import { NextRequest } from 'next/server'

jest.mock('iron-session', () => ({
  getIronSession: jest.fn(),
}))

import { getIronSession } from 'iron-session'
import { middleware } from '@/middleware'

const mockGetIronSession = getIronSession as jest.Mock

process.env.SESSION_SECRET = 'test-secret-32-chars-minimum-here'

function makeReq(path: string, method = 'GET') {
  return new NextRequest(`http://localhost${path}`, { method })
}

beforeEach(() => {
  mockGetIronSession.mockReset()
})

describe('public paths bypass auth', () => {
  it.each(['/', '/api/auth', '/api/auth/anything', '/api/ping'])(
    'allows %s without a session',
    async (path) => {
      const res = await middleware(makeReq(path))
      expect(res.status).not.toBe(401)
      expect(res.status).not.toBe(302)
      expect(mockGetIronSession).not.toHaveBeenCalled()
    },
  )
})

describe('unauthenticated access', () => {
  beforeEach(() => {
    mockGetIronSession.mockResolvedValue({ role: undefined })
  })

  it('returns 401 for unauthenticated API requests', async () => {
    const res = await middleware(makeReq('/api/items'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthenticated')
  })

  it('redirects unauthenticated page requests to /', async () => {
    const res = await middleware(makeReq('/members'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/')
  })
})

describe('viewer role restrictions', () => {
  beforeEach(() => {
    mockGetIronSession.mockResolvedValue({ role: 'viewer' })
  })

  it('allows GET requests for viewers', async () => {
    const res = await middleware(makeReq('/api/items'))
    expect(res.status).not.toBe(403)
  })

  it('blocks non-GET API requests for viewers with 403', async () => {
    const res = await middleware(makeReq('/api/items', 'POST'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('redirects viewers from /settings to /members', async () => {
    const res = await middleware(makeReq('/settings'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/members')
  })
})

describe('editor role', () => {
  beforeEach(() => {
    mockGetIronSession.mockResolvedValue({ role: 'editor' })
  })

  it('allows editors to POST to API routes', async () => {
    const res = await middleware(makeReq('/api/items', 'POST'))
    expect(res.status).not.toBe(403)
  })

  it('allows editors to access /settings', async () => {
    const res = await middleware(makeReq('/settings'))
    expect(res.status).not.toBe(307)
  })
})
