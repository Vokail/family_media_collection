import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'
// Covers can take time to download — bump the timeout ceiling for Vercel
export const maxDuration = 60

export async function GET() {
  const session = await getSession()
  if (session.role !== 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServerClient()

  const [{ data: members }, { data: items }] = await Promise.all([
    db.from('members').select('*').order('name'),
    db.from('items').select('*').order('created_at', { ascending: true }),
  ])

  // Download each cover from Supabase Storage and embed as base64.
  // Process in batches of 10 to avoid exhausting the connection pool on large collections.
  const BATCH_SIZE = 10
  const allItems = items ?? []
  const itemsWithCovers: typeof allItems = []

  for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
    const batch = allItems.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (item) => {
        if (!item.cover_path) return item
        try {
          const storagePath = item.cover_path.startsWith('covers/')
            ? item.cover_path.slice('covers/'.length)
            : item.cover_path
          const { data: blob } = await db.storage.from('covers').download(storagePath)
          if (!blob) return item
          const buffer = Buffer.from(await blob.arrayBuffer())
          return { ...item, cover_data: buffer.toString('base64'), cover_mime: blob.type || 'image/jpeg' }
        } catch {
          return item
        }
      }),
    )
    itemsWithCovers.push(...results)
  }

  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    members: members ?? [],
    items: itemsWithCovers,
  }

  const filename = `collection-backup-${new Date().toISOString().slice(0, 10)}.json`
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
