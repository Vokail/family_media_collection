import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'
import sharp from 'sharp'
import { randomUUID } from 'crypto'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (session.role !== 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServerClient()
  const { data: item } = await db.from('items').select('member_id, cover_path').eq('id', params.id).single()
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await request.formData()
  const file = form.get('cover') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const resized = await sharp(buffer)
    .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  if (item.cover_path) {
    const oldKey = item.cover_path.startsWith('covers/') ? item.cover_path.slice('covers/'.length) : item.cover_path
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
