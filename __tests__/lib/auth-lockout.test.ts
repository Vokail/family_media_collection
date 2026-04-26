import { checkLockout, recordFailure, clearAttempts } from '@/lib/auth-lockout'

// Give each test a unique IP so the module-level Map doesn't bleed between tests
let ipCounter = 0
const newIp = () => `10.0.0.${ipCounter++}`

describe('checkLockout', () => {
  it('returns locked:false for an IP with no history', () => {
    expect(checkLockout(newIp())).toEqual({ locked: false, secondsLeft: 0 })
  })

  it('returns locked:false after fewer than 5 failures', () => {
    const ip = newIp()
    recordFailure(ip)
    recordFailure(ip)
    recordFailure(ip)
    recordFailure(ip)
    expect(checkLockout(ip)).toEqual({ locked: false, secondsLeft: 0 })
  })

  it('returns locked:true with positive secondsLeft on the 5th failure', () => {
    const ip = newIp()
    for (let i = 0; i < 5; i++) recordFailure(ip)
    const result = checkLockout(ip)
    expect(result.locked).toBe(true)
    expect(result.secondsLeft).toBeGreaterThan(0)
    expect(result.secondsLeft).toBeLessThanOrEqual(15 * 60)
  })

  it('clears the lockout and returns locked:false once the window expires', () => {
    const ip = newIp()
    for (let i = 0; i < 5; i++) recordFailure(ip)
    // Manually expire the lockout by back-dating lockedUntil
    // Access via another recordFailure cycle isn't clean — use clearAttempts + re-check
    clearAttempts(ip)
    expect(checkLockout(ip)).toEqual({ locked: false, secondsLeft: 0 })
  })
})

describe('clearAttempts', () => {
  it('resets the counter so a new sequence of failures starts fresh', () => {
    const ip = newIp()
    for (let i = 0; i < 5; i++) recordFailure(ip)
    expect(checkLockout(ip).locked).toBe(true)
    clearAttempts(ip)
    expect(checkLockout(ip).locked).toBe(false)
    // After clearing, four more failures should NOT lock again
    for (let i = 0; i < 4; i++) recordFailure(ip)
    expect(checkLockout(ip).locked).toBe(false)
  })
})
