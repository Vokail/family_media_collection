import { SessionOptions, getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { Role, SessionData } from './types'
import { COOKIE_NAME, MAX_AGE } from './session-config'

const COOKIE_BASE: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: COOKIE_NAME,
  cookieOptions: { secure: process.env.NODE_ENV === 'production' },
}

/**
 * Read the current session.
 *
 * This is read-only: `getIronSession` never writes a cookie unless `.save()` is
 * called, and most callers are Server Components where mutating cookies throws.
 * Sliding renewal therefore happens in middleware, which can write to the
 * response — see RENEW_AFTER_MS in ./session-config.
 */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), COOKIE_BASE)
}

/** Save a new session with the correct maxAge for the given role. */
export async function createSession(role: Role, editableMemberId?: string) {
  const session = await getIronSession<SessionData>(await cookies(), {
    ...COOKIE_BASE,
    cookieOptions: { ...COOKIE_BASE.cookieOptions, maxAge: MAX_AGE[role] },
  })
  session.role = role
  if (editableMemberId) session.editableMemberId = editableMemberId
  // Stamped so middleware knows when this session is due for renewal.
  session.issuedAt = Date.now()
  await session.save()
}
