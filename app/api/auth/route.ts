import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { resolveRole, seedCredentialsIfMissing } from '@/lib/auth'

export async function POST(request: Request) {
  await seedCredentialsIfMissing()
  const { password } = await request.json()
  const role = await resolveRole(password)
  if (!role) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
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
