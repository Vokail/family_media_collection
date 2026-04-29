import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { updateMemberCollections } from '@/lib/db/members'
import type { CollectionType } from '@/lib/types'

const ALL_COLLECTIONS: CollectionType[] = ['vinyl', 'book', 'comic', 'lego']

export async function PATCH(request: Request) {
  const session = await getSession()
  if (session.role !== 'member' || !session.editableMemberId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { enabled_collections } = await request.json()

  if (!Array.isArray(enabled_collections) || enabled_collections.length === 0) {
    return NextResponse.json({ error: 'At least one collection must be enabled' }, { status: 400 })
  }

  const valid = enabled_collections.every((c: unknown) => ALL_COLLECTIONS.includes(c as CollectionType))
  if (!valid) {
    return NextResponse.json({ error: 'Invalid collection type' }, { status: 400 })
  }

  await updateMemberCollections(session.editableMemberId, enabled_collections as CollectionType[])
  return NextResponse.json({ ok: true })
}
