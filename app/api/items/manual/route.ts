import { NextResponse } from 'next/server'
import { getMemberBySlug } from '@/lib/db/members'
import { createItem } from '@/lib/db/items'
import type { CollectionType } from '@/lib/types'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { createServerClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'

const VALID_COLLECTIONS: CollectionType[] = ['vinyl', 'book', 'comic', 'lego']

export async function POST(request: Request) {
  const session = await getSession()
  if (!session.role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await request.formData()
  const memberSlug = form.get('memberSlug') as string
  const collection = form.get('collection') as CollectionType
  const title = (form.get('title') as string)?.trim()
  const creator = (form.get('creator') as string)?.trim() || ''
  const yearRaw = form.get('year') as string
  const year = yearRaw ? parseInt(yearRaw) : null
  const isWishlist = form.get('is_wishlist') === 'true'
  const isbn = (form.get('isbn') as string)?.trim() || null
  const coverFile = form.get('cover') as File | null

  if (!memberSlug || !collection || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!VALID_COLLECTIONS.includes(collection)) {
    return NextResponse.json({ error: 'Invalid collection' }, { status: 400 })
  }

  const force = form.get('force') === 'true'

  try {
    const member = await getMemberBySlug(memberSlug)
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Members can only add to their own collection
    if (session.role === 'member' && session.editableMemberId !== member.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Duplicate check — case-insensitive title + creator match within same member + collection
    if (!force) {
      const db = createServerClient()
      const { data: existing } = await db
        .from('items')
        .select('id, title, creator, year')
        .eq('member_id', member.id)
        .eq('collection', collection)
        .ilike('title', title)
        .ilike('creator', creator || '')
        .limit(1)
        .single()
      if (existing) {
        return NextResponse.json({ error: 'Duplicate', existing }, { status: 409 })
      }
    }

    let cover_path: string | null = null
    if (coverFile && coverFile.size > 0) {
      const buffer = Buffer.from(await coverFile.arrayBuffer())
      const resized = await sharp(buffer)
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      const db = createServerClient()
      const path = `manual/${member.id}/${randomUUID()}.jpg`
      const { error } = await db.storage.from('covers').upload(path, resized, { contentType: 'image/jpeg' })
      if (error) return NextResponse.json({ error: 'Cover upload failed' }, { status: 500 })
      cover_path = `covers/${path}`
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
      external_id: null,
      sort_name: null,
      tracklist: null,
      description: null,
      rating: null,
      isbn,
      genres: null,
      styles: null,
      status: null,
      lego_status: null,
      locked_fields: null,
    })

    return NextResponse.json(item, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
