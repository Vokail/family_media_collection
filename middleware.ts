import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import type { SessionData } from './lib/types'

const PUBLIC_PATHS = ['/', '/api/auth', '/api/ping']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, {
    password: process.env.SESSION_SECRET!,
    cookieName: 'fmc_session',
  })

  if (!session.role) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Block viewers from write API routes
  const isWriteApi = request.method !== 'GET' && pathname.startsWith('/api/')
  if (isWriteApi && session.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Block viewers from settings page
  if (pathname.startsWith('/settings') && session.role === 'viewer') {
    return NextResponse.redirect(new URL('/members', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
