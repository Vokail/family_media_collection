const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

// NOTE: This map is stored in the serverless function's module scope.
// On Vercel each function instance has its own memory, so lockout state is lost
// on cold starts and is not shared across concurrent instances.
// For a small family app this is acceptable — an attacker would need to hit
// the same warm instance to exhaust attempts. If stronger guarantees are ever
// needed, move this state to Supabase (e.g. a `login_attempts` table with a
// cron to prune old rows) or Redis/Upstash.
interface Attempt { count: number; lockedUntil: number | null; lastFailure: number }
const attempts = new Map<string, Attempt>()

export function checkLockout(ip: string): { locked: boolean; secondsLeft: number } {
  const a = attempts.get(ip)
  if (!a) return { locked: false, secondsLeft: 0 }

  // Expire entries that never reached lockout threshold but are older than LOCKOUT_MS.
  // Without this, repeated failed logins below the threshold accumulate in memory forever.
  if (!a.lockedUntil) {
    if (Date.now() - a.lastFailure > LOCKOUT_MS) { attempts.delete(ip); return { locked: false, secondsLeft: 0 } }
    return { locked: false, secondsLeft: 0 }
  }

  const left = a.lockedUntil - Date.now()
  if (left <= 0) { attempts.delete(ip); return { locked: false, secondsLeft: 0 } }
  return { locked: true, secondsLeft: Math.ceil(left / 1000) }
}

export function recordFailure(ip: string) {
  const a = attempts.get(ip) ?? { count: 0, lockedUntil: null, lastFailure: 0 }
  a.count += 1
  a.lastFailure = Date.now()
  a.lockedUntil = a.count >= MAX_ATTEMPTS ? a.lastFailure + LOCKOUT_MS : null
  attempts.set(ip, a)
}

export function clearAttempts(ip: string) {
  attempts.delete(ip)
}
