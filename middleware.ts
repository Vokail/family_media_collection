import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from './lib/types'
import { COOKIE_NAME, MAX_AGE, RENEW_AFTER_MS } from './lib/session-config'

const PUBLIC_PATHS = ['/', '/api/auth', '/api/ping', '/api/playwright-fixtures']

/**
 * Slide the session expiry so an active user is never logged out mid-use.
 *
 * The role is only known after the cookie is read, so renewal needs a second
 * handle configured with that role's maxAge. Skipped unless the cookie is older
 * than RENEW_AFTER_MS, which keeps this to roughly one re-seal per hour.
 */
async function renewIfStale(
  request: NextRequest,
  response: NextResponse,
  role: NonNullable<SessionData['role']>,
  issuedAt: number | undefined,
) {
  // Sessions issued before issuedAt existed have no stamp — renew them once so
  // they pick one up rather than re-sealing on every subsequent request.
  if (issuedAt !== undefined && Date.now() - issuedAt < RENEW_AFTER_MS) return

  const renewed = await getIronSession<SessionData>(request, response, {
    password: process.env.SESSION_SECRET!,
    cookieName: COOKIE_NAME,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: MAX_AGE[role],
    },
  })
  if (!renewed.role) return
  renewed.issuedAt = Date.now()
  await renewed.save()
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, {
    password: process.env.SESSION_SECRET!,
    cookieName: COOKIE_NAME,
  })

  if (!session.role) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Block viewers from write API routes
  const isWriteApi = request.method !== 'GET' && pathname.startsWith('/api/')
  if (isWriteApi && session.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Block non-editors from settings page
  if (pathname.startsWith('/settings') && session.role !== 'editor') {
    return NextResponse.redirect(new URL('/members', request.url))
  }

  await renewIfStale(request, response, session.role, session.issuedAt)

  return response
}

export const config = {
  // Exclude Next.js internals AND all static public files (images, icons, manifest, sw)
  matcher: ['/((?!_next/static|_next/image|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$|.*\\.webmanifest$|manifest\\.json$|sw\\.js$).*)'],
}
