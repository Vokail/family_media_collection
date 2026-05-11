import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'
import { randomUUID } from 'crypto'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '@/lib/constants'
import { coverStorageKey, uploadImageBuffer } from '@/lib/cover'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.role || session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServerClient()
  const { data: item } = await db.from('items').select('member_id, cover_path').eq('id', id).single()
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Members can only upload covers for their own items
  if (session.role === 'member' && session.editableMemberId !== item.member_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const form = await request.formData()
  const file = form.get('cover') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  if (file.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  if (item.cover_path) {
    const oldKey = coverStorageKey(item.cover_path)
    await db.storage.from('covers').remove([oldKey])
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `manual/${item.member_id}/${randomUUID()}.jpg`
  const cover_path = await uploadImageBuffer(buffer, storagePath)
  if (!cover_path) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  const { data: updated, error: updateError } = await db.from('items').update({ cover_path }).eq('id', id).select().single()
  if (updateError) return NextResponse.json({ error: 'DB update failed' }, { status: 500 })

  return NextResponse.json(updated)
}
