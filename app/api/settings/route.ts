import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { updateCredential, updateMemberPin } from '@/lib/auth'

export async function PATCH(request: Request) {
  const session = await getSession()
  if (session.role !== 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { target, newValue, memberId } = await request.json()

  if (target === 'member_pin') {
    if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })
    if (!newValue || newValue.length < 4) {
      return NextResponse.json({ error: 'Must be at least 4 characters' }, { status: 400 })
    }
    await updateMemberPin(memberId, newValue)
    return NextResponse.json({ ok: true })
  }

  if (!['view_pin_hash', 'family_password_hash'].includes(target)) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }
  if (!newValue || newValue.length < 4) {
    return NextResponse.json({ error: 'Must be at least 4 characters' }, { status: 400 })
  }
  await updateCredential(target as 'view_pin_hash' | 'family_password_hash', newValue)
  return NextResponse.json({ ok: true })
}
