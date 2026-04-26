import { NextResponse } from 'next/server'
import { getMemberBySlug } from '@/lib/db/members'
import { createItem } from '@/lib/db/items'
import type { CollectionType } from '@/lib/types'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const form = await request.formData()
  const memberSlug = form.get('memberSlug') as string
  const collection = form.get('collection') as CollectionType
  const title = (form.get('title') as string)?.trim()
  const creator = (form.get('creator') as string)?.trim() || ''
  const yearRaw = form.get('year') as string
  const year = yearRaw ? parseInt(yearRaw) : null
  const isWishlist = form.get('is_wishlist') === 'true'
  const coverFile = form.get('cover') as File | null

  if (!memberSlug || !collection || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const member = await getMemberBySlug(memberSlug)
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  let cover_path: string | null = null
  if (coverFile && coverFile.size > 0) {
    const buffer = Buffer.from(await coverFile.arrayBuffer())
    const resized = await sharp(buffer)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
    const db = createServerClient()
    const path = `${member.id}/${randomUUID()}.jpg`
    const { error } = await db.storage.from('covers').upload(path, resized, { contentType: 'image/jpeg' })
    if (!error) cover_path = `covers/${path}`
  }

  const item = await createItem({
    member_id: member.id,
    collection,
    title,
    creator,
    year,
    cover_path,
    is_wishlist: isWishlist,
    notes: null,
  })

  return NextResponse.json(item, { status: 201 })
}
