import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import sharp from 'sharp'
import { randomUUID } from 'crypto'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const db = createServerClient()
  const { data: item } = await db.from('items').select('member_id, cover_path').eq('id', params.id).single()
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await request.formData()
  const file = form.get('cover') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const resized = await sharp(buffer)
    .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  // Remove old cover if present
  if (item.cover_path) {
    const oldKey = item.cover_path.replace('covers/', '')
    await db.storage.from('covers').remove([oldKey])
  }

  const path = `manual/${item.member_id}/${randomUUID()}.jpg`
  const { error } = await db.storage.from('covers').upload(path, resized, { contentType: 'image/jpeg' })
  if (error) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  const cover_path = `covers/${path}`
  const { data: updated, error: updateError } = await db.from('items').update({ cover_path }).eq('id', params.id).select().single()
  if (updateError) return NextResponse.json({ error: 'DB update failed' }, { status: 500 })

  return NextResponse.json(updated)
}
