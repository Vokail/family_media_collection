import { NextResponse } from 'next/server'
import { updateItem, deleteItem } from '@/lib/db/items'
import { createServerClient } from '@/lib/supabase-server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const patch = await request.json()
  const item = await updateItem(id, patch)
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
    await db.storage.from('covers').remove([data.cover_path.replace('covers/', '')])
  }
  return NextResponse.json({ ok: true })
}
