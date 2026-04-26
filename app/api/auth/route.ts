import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createSession, getSession } from '@/lib/session'
import { resolveRole, seedCredentialsIfMissing } from '@/lib/auth'
import { checkLockout, recordFailure, clearAttempts } from '@/lib/auth-lockout'

function getIp(): string {
  const hdrs = headers()
  return hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
}

export async function POST(request: Request) {
  const ip = getIp()
  const { locked, secondsLeft } = checkLockout(ip)
  if (locked) {
    const mins = Math.ceil(secondsLeft / 60)
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 429 },
    )
  }

  let body: { password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { password } = body
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password required' }, { status: 400 })
  }

  await seedCredentialsIfMissing()
  const role = await resolveRole(password)
  if (!role) {
    recordFailure(ip)
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  clearAttempts(ip)
  await createSession(role)
  return NextResponse.json({ role })
}

export async function DELETE() {
  const session = await getSession()
  session.destroy()
  return NextResponse.json({ ok: true })
}
