import { SessionOptions, getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { Role, SessionData } from './types'

const COOKIE_BASE: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'fmc_session',
  cookieOptions: { secure: process.env.NODE_ENV === 'production' },
}

const MAX_AGE: Record<Role, number> = {
  editor: 60 * 60 * 8,        // 8 hours
  viewer: 60 * 60 * 24 * 7,   // 7 days
  member: 60 * 60 * 24 * 7,   // 7 days
}

/** Read the current session (uses viewer maxAge for cookie renewal). */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), {
    ...COOKIE_BASE,
    cookieOptions: { ...COOKIE_BASE.cookieOptions, maxAge: MAX_AGE.viewer },
  })
}

/** Save a new session with the correct maxAge for the given role. */
export async function createSession(role: Role, editableMemberId?: string) {
  const session = await getIronSession<SessionData>(await cookies(), {
    ...COOKIE_BASE,
    cookieOptions: { ...COOKIE_BASE.cookieOptions, maxAge: MAX_AGE[role] },
  })
  session.role = role
  if (editableMemberId) session.editableMemberId = editableMemberId
  await session.save()
}
