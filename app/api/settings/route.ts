import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { updateCredential, updateMemberPin } from '@/lib/auth'

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session.role) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { target, newValue, memberId } = await request.json()

  if (target === 'member_pin') {
    if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })
    if (!newValue || newValue.length < 4) {
      return NextResponse.json({ error: 'Must be at least 4 digits' }, { status: 400 })
    }
    if (!/^\d+$/.test(newValue)) {
      return NextResponse.json({ error: 'PIN must contain digits only' }, { status: 400 })
    }
    // Members can only update their own PIN; editors can update any
    if (session.role === 'member') {
      if (session.editableMemberId !== memberId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (session.role !== 'editor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const result = await updateMemberPin(memberId, newValue)
    if (result === 'conflict') {
      return NextResponse.json({ error: 'Invalid PIN, please choose a different one' }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  }

  // All other targets are editor-only
  if (session.role !== 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!['view_pin_hash', 'family_password_hash'].includes(target)) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
  }
  if (!newValue || newValue.length < 4) {
    return NextResponse.json({ error: 'Must be at least 4 characters' }, { status: 400 })
  }
  await updateCredential(target as 'view_pin_hash' | 'family_password_hash', newValue)
  return NextResponse.json({ ok: true })
}
