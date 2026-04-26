import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'
import sharp from 'sharp'
import { randomUUID } from 'crypto'

export const maxDuration = 60

interface ExportMember { id: string; name: string; slug: string }
interface ExportItem {
  member_id: string
  collection: string
  title: string
  creator: string
  year: number | null
  cover_path: string | null
  cover_data?: string
  cover_mime?: string
  is_wishlist: boolean
  notes: string | null
  external_id: string | null
  sort_name: string | null
  tracklist: unknown
  description: string | null
  isbn: string | null
}

export async function POST(request: Request) {
  const session = await getSession()
  if (session.role !== 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { version: number; members: ExportMember[]; items: ExportItem[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.version !== 1) return NextResponse.json({ error: 'Unknown export version' }, { status: 400 })

  const db = createServerClient()

  // Build slug → new id map, creating members that don't exist yet
  const { data: existingMembers } = await db.from('members').select('*')
  const memberMap = new Map<string, string>() // slug → id in target DB
  for (const m of existingMembers ?? []) memberMap.set(m.slug, m.id)

  for (const m of body.members ?? []) {
    if (!memberMap.has(m.slug)) {
      const { data } = await db.from('members').insert({ name: m.name, slug: m.slug }).select().single()
      if (data) memberMap.set(data.slug, data.id)
    }
  }

  // Build a set of existing items to skip duplicates (member_id + collection + title)
  const { data: existingItems } = await db.from('items').select('member_id, collection, title')
  const existingSet = new Set(
    (existingItems ?? []).map(i => `${i.member_id}|${i.collection}|${i.title.toLowerCase().trim()}`),
  )

  // Build old-id → slug map from the export so we can resolve member_id
  const oldIdToSlug = new Map<string, string>()
  for (const m of body.members ?? []) oldIdToSlug.set(m.id, m.slug)

  let imported = 0
  let skipped = 0

  for (const item of body.items ?? []) {
    const slug = oldIdToSlug.get(item.member_id)
    const memberId = slug ? memberMap.get(slug) : undefined
    if (!memberId) { skipped++; continue }

    const dupKey = `${memberId}|${item.collection}|${item.title.toLowerCase().trim()}`
    if (existingSet.has(dupKey)) { skipped++; continue }

    let cover_path: string | null = null
    if (item.cover_data) {
      try {
        const buffer = Buffer.from(item.cover_data, 'base64')
        const resized = await sharp(buffer)
          .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
        const path = `${memberId}/${randomUUID()}.jpg`
        const { error } = await db.storage.from('covers').upload(path, resized, { contentType: 'image/jpeg' })
        if (!error) cover_path = `covers/${path}`
      } catch { /* skip cover if it fails */ }
    }

    const { error } = await db.from('items').insert({
      member_id: memberId,
      collection: item.collection,
      title: item.title,
      creator: item.creator ?? '',
      year: item.year ?? null,
      cover_path,
      is_wishlist: item.is_wishlist ?? false,
      notes: item.notes ?? null,
      external_id: item.external_id ?? null,
      sort_name: item.sort_name ?? null,
      tracklist: item.tracklist ?? null,
      description: item.description ?? null,
      isbn: item.isbn ?? null,
    })

    if (!error) {
      imported++
      existingSet.add(dupKey)
    } else {
      skipped++
    }
  }

  return NextResponse.json({ imported, skipped })
}
