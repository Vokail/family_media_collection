import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

const DISCOGS_BASE = 'https://api.discogs.com'
const discogsHeaders = () => ({
  Authorization: `Discogs token=${process.env.DISCOGS_API_KEY}`,
  'User-Agent': 'FamilyMediaCollection/1.0',
})

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchDiscogsRelease(releaseId: string) {
  const res = await fetch(`${DISCOGS_BASE}/releases/${releaseId}`, { headers: discogsHeaders() })
  if (!res.ok) return null
  return res.json()
}

async function searchDiscogsRelease(creator: string, title: string): Promise<string | null> {
  const q = encodeURIComponent(`${creator} ${title}`)
  const res = await fetch(`${DISCOGS_BASE}/database/search?q=${q}&type=release&format=vinyl&per_page=3`, { headers: discogsHeaders() })
  if (!res.ok) return null
  const data = await res.json()
  return data.results?.[0]?.id ? String(data.results[0].id) : null
}

async function fetchBookDescription(externalId: string): Promise<string | null> {
  try {
    if (!externalId?.startsWith('/works/')) return null
    const res = await fetch(`https://openlibrary.org${externalId}.json`)
    if (!res.ok) return null
    const data = await res.json()
    const desc = data.description
    if (!desc) return null
    return typeof desc === 'string' ? desc : (desc.value as string) ?? null
  } catch { return null }
}

export async function GET(request: Request) {
  const { getSession } = await import('@/lib/session')
  const session = await getSession()
  if (session.role !== 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const force = new URL(request.url).searchParams.get('force') === 'true'
  const db = createServerClient()
  const summary: Record<string, { total: number; updated: number }> = {}

  // --- Vinyl: sort_name + tracklist ---
  const vinylQuery = db.from('items').select('id, creator, title, external_id').eq('collection', 'vinyl')
  const { data: vinylItems } = force ? await vinylQuery : await vinylQuery.or('sort_name.is.null,tracklist.is.null')
  summary.vinyl = { total: vinylItems?.length ?? 0, updated: 0 }

  for (const item of vinylItems ?? []) {
    try {
      let releaseId = item.external_id
      if (!releaseId) {
        releaseId = await searchDiscogsRelease(item.creator, item.title)
        await delay(1100)
      }
      if (!releaseId) continue
      const release = await fetchDiscogsRelease(releaseId)
      await delay(1100)
      if (!release) continue
      const sort_name = (release.artists_sort as string) || null
      const tracklist = (release.tracklist ?? []).map((t: Record<string, unknown>) => ({
        position: (t.position as string) || '',
        title: (t.title as string) || '',
        duration: (t.duration as string) || null,
      }))
      await db.from('items').update({
        sort_name,
        tracklist: tracklist.length ? tracklist : null,
        external_id: item.external_id ?? releaseId,
      }).eq('id', item.id)
      summary.vinyl.updated++
    } catch { /* skip */ }
  }

  // --- Books: description ---
  const bookQuery = db.from('items').select('id, external_id').eq('collection', 'book').not('external_id', 'is', null)
  const { data: bookItems } = force ? await bookQuery : await bookQuery.is('description', null)
  summary.books = { total: bookItems?.length ?? 0, updated: 0 }

  for (const item of bookItems ?? []) {
    const description = await fetchBookDescription(item.external_id)
    if (description) {
      await db.from('items').update({ description }).eq('id', item.id)
      summary.books.updated++
    }
    await delay(300)
  }

  return NextResponse.json({ force, summary })
}
