import { NextResponse } from 'next/server'
import { updateItem, deleteItem } from '@/lib/db/items'
import { createServerClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const session = await getSession()
    if (!session.role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data, error } = await createServerClient().from('items').select('*').eq('id', id).single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const PATCHABLE_KEYS = ['is_wishlist', 'notes', 'cover_path', 'rating', 'status', 'lego_status', 'condition', 'title', 'creator', 'year'] as const
type PatchKey = typeof PATCHABLE_KEYS[number]

// Fields that, when manually edited, should be locked against backfill overwrites.
// cover_path is included so that manual photo uploads are never overwritten by backfill.
const LOCKABLE_FIELDS = ['title', 'creator', 'year', 'cover_path'] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const raw = await request.json()
  const patch: Partial<Record<PatchKey, unknown>> = {}
  for (const key of PATCHABLE_KEYS) {
    if (key in raw) patch[key] = raw[key]
  }

  // Determine which lockable fields are being manually set
  const newlyLocked = LOCKABLE_FIELDS.filter(f => f in raw)

  try {
    const db = createServerClient()
    const [session, { data: existing }] = await Promise.all([
      getSession(),
      db.from('items').select('member_id, locked_fields').eq('id', id).single(),
    ])
    if (session.role === 'member' && session.editableMemberId !== existing?.member_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Merge newly locked fields with any already locked, deduped
    if (newlyLocked.length > 0) {
      const current: string[] = existing?.locked_fields ?? []
      const merged = Array.from(new Set([...current, ...newlyLocked]))
      await db.from('items').update({ locked_fields: merged }).eq('id', id)
    }

    const item = await updateItem(id, patch as Parameters<typeof updateItem>[1])
    return NextResponse.json(item)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const db = createServerClient()
    const [session, { data }] = await Promise.all([
      getSession(),
      db.from('items').select('cover_path, member_id').eq('id', id).single(),
    ])
    if (session.role === 'member' && session.editableMemberId !== data?.member_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await deleteItem(id)
    if (data?.cover_path) {
      const key = data.cover_path.startsWith('covers/') ? data.cover_path.slice('covers/'.length) : data.cover_path
      await db.storage.from('covers').remove([key])
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
