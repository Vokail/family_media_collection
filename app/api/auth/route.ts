import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getSession } from '@/lib/session'
import { resolveRole, seedCredentialsIfMissing } from '@/lib/auth'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

interface Attempt { count: number; lockedUntil: number | null }
const attempts = new Map<string, Attempt>()

function getIp(req: Request): string {
  const hdrs = headers()
  return hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

function checkLockout(ip: string): { locked: boolean; secondsLeft: number } {
  const a = attempts.get(ip)
  if (!a?.lockedUntil) return { locked: false, secondsLeft: 0 }
  const left = a.lockedUntil - Date.now()
  if (left <= 0) { attempts.delete(ip); return { locked: false, secondsLeft: 0 } }
  return { locked: true, secondsLeft: Math.ceil(left / 1000) }
}

function recordFailure(ip: string) {
  const a = attempts.get(ip) ?? { count: 0, lockedUntil: null }
  a.count += 1
  a.lockedUntil = a.count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null
  attempts.set(ip, a)
}

export async function POST(request: Request) {
  const ip = getIp(request)
  const { locked, secondsLeft } = checkLockout(ip)
  if (locked) {
    const mins = Math.ceil(secondsLeft / 60)
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 429 },
    )
  }

  await seedCredentialsIfMissing()
  const { password } = await request.json()
  const role = await resolveRole(password)
  if (!role) {
    recordFailure(ip)
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  attempts.delete(ip) // clear on success
  const session = await getSession()
  session.role = role
  await session.save()
  return NextResponse.json({ role })
}

export async function DELETE() {
  const session = await getSession()
  session.destroy()
  return NextResponse.json({ ok: true })
}
