import { NextRequest } from 'next/server'

jest.mock('iron-session', () => ({
  getIronSession: jest.fn(),
}))

import { getIronSession } from 'iron-session'
import { middleware } from '@/middleware'

const mockGetIronSession = getIronSession as jest.Mock

process.env.SESSION_SECRET = 'test-secret-32-chars-minimum-here'


// Sessions are objects with a save() — middleware calls it to slide the expiry.
// `issuedAt` defaults to "just now" so renewal stays off unless a test asks for it.
function makeSession(role: string | undefined, issuedAt: number | undefined = Date.now()) {
  return { role, issuedAt, save: jest.fn().mockResolvedValue(undefined) }
}

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
    mockGetIronSession.mockResolvedValue(makeSession(undefined))
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
    mockGetIronSession.mockResolvedValue(makeSession('viewer'))
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
    mockGetIronSession.mockResolvedValue(makeSession('editor'))
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

describe('sliding session renewal', () => {
  it('does not re-issue a cookie for a freshly issued session', async () => {
    const session = makeSession('editor', Date.now())
    mockGetIronSession.mockResolvedValue(session)

    await middleware(makeReq('/members'))

    expect(session.save).not.toHaveBeenCalled()
  })

  it('re-issues the cookie once the session is older than the renewal window', async () => {
    const session = makeSession('editor', Date.now() - 61 * 60 * 1000)
    mockGetIronSession.mockResolvedValue(session)

    await middleware(makeReq('/members'))

    expect(session.save).toHaveBeenCalledTimes(1)
    expect(session.issuedAt).toBeGreaterThan(Date.now() - 5000)
  })

  it('renews with the maxAge for the session role, not a hardcoded one', async () => {
    const session = makeSession('viewer', Date.now() - 61 * 60 * 1000)
    mockGetIronSession.mockResolvedValue(session)

    await middleware(makeReq('/members'))

    // Second call is the renewal handle — it must carry the viewer maxAge (7 days)
    const renewalOpts = mockGetIronSession.mock.calls[1][2]
    expect(renewalOpts.cookieOptions.maxAge).toBe(60 * 60 * 24 * 7)
  })

  it('stamps legacy sessions that predate issuedAt', async () => {
    // Built inline: a default parameter cannot express "issuedAt key absent"
    const session = { role: 'editor', save: jest.fn().mockResolvedValue(undefined) } as {
      role: string; save: jest.Mock; issuedAt?: number
    }
    mockGetIronSession.mockResolvedValue(session)

    await middleware(makeReq('/members'))

    expect(session.save).toHaveBeenCalledTimes(1)
    expect(typeof session.issuedAt).toBe('number')
  })

  it('does not renew on public paths', async () => {
    const session = makeSession('editor', Date.now() - 61 * 60 * 1000)
    mockGetIronSession.mockResolvedValue(session)

    await middleware(makeReq('/api/ping'))

    expect(session.save).not.toHaveBeenCalled()
  })
})
