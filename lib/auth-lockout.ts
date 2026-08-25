// Login throttling: progressive delay rather than a hard lockout.
//
// A fixed lockout (the previous behaviour: 5 failures => blocked for 15 minutes)
// is a denial-of-service vector against the legitimate user — anyone who forgets
// their password locks themselves out of their own app for a quarter of an hour,
// and because the lockout is checked *before* the password is validated, even
// knowing the correct password cannot clear it.
//
// Validating the password while locked is not an acceptable fix: it would give an
// attacker unlimited guesses and make the throttle purely cosmetic. Instead each
// failure past the free allowance requires an exponentially longer wait, capped
// at MAX_DELAY_MS. An attacker is throttled to ~1 guess/minute (on top of bcrypt
// cost 10), while someone who knows their password never waits more than the cap.
const FREE_ATTEMPTS = 5
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 60 * 1000
// An IP that stops failing for this long is forgotten entirely.
const IDLE_RESET_MS = 15 * 60 * 1000

// NOTE: This map is stored in the serverless function's module scope.
// On Vercel each function instance has its own memory, so throttle state is lost
// on cold starts and is not shared across concurrent instances.
// For a small family app this is acceptable — an attacker would need to hit
// the same warm instance to build up a delay. If stronger guarantees are ever
// needed, move this state to Supabase (e.g. a `login_attempts` table with a
// cron to prune old rows) or Redis/Upstash.
interface Attempt { count: number; lastFailure: number }
const attempts = new Map<string, Attempt>()

/** Wait required before the next attempt is accepted, given this many failures. */
function requiredDelayMs(count: number): number {
  if (count < FREE_ATTEMPTS) return 0
  return Math.min(BASE_DELAY_MS * 2 ** (count - FREE_ATTEMPTS), MAX_DELAY_MS)
}

export function checkLockout(ip: string): { locked: boolean; secondsLeft: number } {
  const a = attempts.get(ip)
  if (!a) return { locked: false, secondsLeft: 0 }

  const sinceLastFailure = Date.now() - a.lastFailure

  // Sweep entries that have gone quiet, so failures never accumulate forever
  // (both in memory and against the user).
  if (sinceLastFailure >= IDLE_RESET_MS) {
    attempts.delete(ip)
    return { locked: false, secondsLeft: 0 }
  }

  const msLeft = requiredDelayMs(a.count) - sinceLastFailure
  if (msLeft <= 0) return { locked: false, secondsLeft: 0 }
  return { locked: true, secondsLeft: Math.ceil(msLeft / 1000) }
}

export function recordFailure(ip: string) {
  const a = attempts.get(ip) ?? { count: 0, lastFailure: 0 }
  a.count += 1
  a.lastFailure = Date.now()
  attempts.set(ip, a)
}

export function clearAttempts(ip: string) {
  attempts.delete(ip)
}
