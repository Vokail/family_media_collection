const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

interface Attempt { count: number; lockedUntil: number | null }
const attempts = new Map<string, Attempt>()

export function checkLockout(ip: string): { locked: boolean; secondsLeft: number } {
  const a = attempts.get(ip)
  if (!a?.lockedUntil) return { locked: false, secondsLeft: 0 }
  const left = a.lockedUntil - Date.now()
  if (left <= 0) { attempts.delete(ip); return { locked: false, secondsLeft: 0 } }
  return { locked: true, secondsLeft: Math.ceil(left / 1000) }
}

export function recordFailure(ip: string) {
  const a = attempts.get(ip) ?? { count: 0, lockedUntil: null }
  a.count += 1
  a.lockedUntil = a.count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null
  attempts.set(ip, a)
}

export function clearAttempts(ip: string) {
  attempts.delete(ip)
}
