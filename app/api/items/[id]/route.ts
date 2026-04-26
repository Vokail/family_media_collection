import { NextResponse } from 'next/server'
import { updateItem, deleteItem } from '@/lib/db/items'
import { createServerClient } from '@/lib/supabase-server'

const PATCHABLE_KEYS = ['is_wishlist', 'notes', 'cover_path'] as const
type PatchKey = typeof PATCHABLE_KEYS[number]

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
  const item = await updateItem(id, patch as Parameters<typeof updateItem>[1])
  return NextResponse.json(item)
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createServerClient()
  const { data } = await db.from('items').select('cover_path').eq('id', id).single()
  await deleteItem(id)
  if (data?.cover_path) {
    const key = data.cover_path.startsWith('covers/') ? data.cover_path.slice('covers/'.length) : data.cover_path
    await db.storage.from('covers').remove([key])
  }
  return NextResponse.json({ ok: true })
}
