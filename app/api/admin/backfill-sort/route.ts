import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

const DISCOGS_BASE = 'https://api.discogs.com'
const discogsHeaders = () => ({
  Authorization: `Discogs token=${process.env.DISCOGS_API_KEY}`,
  'User-Agent': 'FamilyMediaCollection/1.0',
})

async function fetchSortName(creator: string, title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${creator} ${title}`)
    const searchRes = await fetch(`${DISCOGS_BASE}/database/search?q=${q}&type=release&format=vinyl&per_page=3`, { headers: discogsHeaders() })
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const releaseId = searchData.results?.[0]?.id
    if (!releaseId) return null
    await new Promise(r => setTimeout(r, 1100))
    const releaseRes = await fetch(`${DISCOGS_BASE}/releases/${releaseId}`, { headers: discogsHeaders() })
    if (!releaseRes.ok) return null
    const releaseData = await releaseRes.json()
    return (releaseData.artists_sort as string) || null
  } catch {
    return null
  }
}

async function fetchDescription(externalId: string): Promise<string | null> {
  try {
    if (!externalId.startsWith('/works/')) return null
    const res = await fetch(`https://openlibrary.org${externalId}.json`)
    if (!res.ok) return null
    const data = await res.json()
    const desc = data.description
    if (!desc) return null
    return typeof desc === 'string' ? desc : (desc.value as string) ?? null
  } catch {
    return null
  }
}

export async function GET() {
  const { getSession } = await import('@/lib/session')
  const session = await getSession()
  if (session.role !== 'editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createServerClient()
  const summary: Record<string, { total: number; updated: number }> = {}

  // Backfill vinyl sort names
  const { data: vinylItems } = await db.from('items').select('id, creator, title').eq('collection', 'vinyl').is('sort_name', null)
  summary.vinyl = { total: vinylItems?.length ?? 0, updated: 0 }
  for (const item of vinylItems ?? []) {
    const sort_name = await fetchSortName(item.creator, item.title)
    if (sort_name) { await db.from('items').update({ sort_name }).eq('id', item.id); summary.vinyl.updated++ }
    await new Promise(r => setTimeout(r, 1100))
  }

  // Backfill book descriptions
  const { data: bookItems } = await db.from('items').select('id, external_id').eq('collection', 'book').is('description', null).not('external_id', 'is', null)
  summary.books = { total: bookItems?.length ?? 0, updated: 0 }
  for (const item of bookItems ?? []) {
    const description = await fetchDescription(item.external_id)
    if (description) { await db.from('items').update({ description }).eq('id', item.id); summary.books.updated++ }
    await new Promise(r => setTimeout(r, 500))
  }

  return NextResponse.json({ summary })
}
