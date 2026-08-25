// Session constants shared by lib/session.ts (Node runtime) and middleware.ts
// (Edge runtime). Kept free of `next/headers` so middleware can import it.
import type { Role } from './types'

export const COOKIE_NAME = 'fmc_session'

/** How long a session stays valid, measured from its last renewal. */
export const MAX_AGE: Record<Role, number> = {
  editor: 60 * 60 * 8,        // 8 hours
  viewer: 60 * 60 * 24 * 7,   // 7 days
  member: 60 * 60 * 24 * 7,   // 7 days
}

/**
 * Sessions slide: middleware re-issues the cookie once it is older than this, so
 * an active user is never logged out mid-use. Re-issuing on *every* request would
 * re-seal the cookie and attach a Set-Cookie header to every response, so we only
 * renew once per hour of continuous use.
 */
export const RENEW_AFTER_MS = 60 * 60 * 1000
