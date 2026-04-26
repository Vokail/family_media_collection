import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { updateCredential } from '@/lib/auth'

export async function PATCH(request: Request) {
  const session = await getSession()
  if (session.role !== 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { target, newValue } = await request.json()
  if (!['view_pin_hash', 'family_password_hash'].includes(target)) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }
  if (!newValue || newValue.length < 4) {
    return NextResponse.json({ error: 'Must be at least 4 characters' }, { status: 400 })
  }
  await updateCredential(target as 'view_pin_hash' | 'family_password_hash', newValue)
  return NextResponse.json({ ok: true })
}
