import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { updateMemberCollections, updateMemberAvatar } from '@/lib/db/members'
import { createServerClient } from '@/lib/supabase-server'
import type { CollectionType } from '@/lib/types'
import sharp from 'sharp'

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

export async function PUT(request: Request) {
  const session = await getSession()
  if (session.role !== 'member' || !session.editableMemberId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const memberId = session.editableMemberId

  const formData = await request.formData()
  const file = formData.get('avatar') as File | null
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  // Resize and crop to a square, output as JPEG
  const resized = await sharp(buffer)
    .resize(400, 400, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 85 })
    .toBuffer()

  const db = createServerClient()
  const storagePath = `avatars/${memberId}.jpg`

  const { error } = await db.storage
    .from('covers')
    .upload(storagePath, resized, { contentType: 'image/jpeg', upsert: true })

  if (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  await updateMemberAvatar(memberId, storagePath)
  return NextResponse.json({ avatar_path: storagePath })
}
