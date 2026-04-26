import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

const DISCOGS_BASE = 'https://api.discogs.com'
const discogsHeaders = () => ({
  Authorization: `Discogs token=${process.env.DISCOGS_API_KEY}`,
  'User-Agent': 'FamilyMediaCollection/1.0',
})

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

// --- Vinyl ---
async function searchDiscogsId(creator: string, title: string): Promise<string | null> {
  const q = encodeURIComponent(`${creator} ${title}`)
  const res = await fetch(`${DISCOGS_BASE}/database/search?q=${q}&type=release&format=vinyl&per_page=3`, { headers: discogsHeaders() })
  if (!res.ok) return null
  const data = await res.json()
  return data.results?.[0]?.id ? String(data.results[0].id) : null
}

async function fetchDiscogsRelease(id: string) {
  const res = await fetch(`${DISCOGS_BASE}/releases/${id}`, { headers: discogsHeaders() })
  return res.ok ? res.json() : null
}

async function backfillVinyl(db: ReturnType<typeof createServerClient>, force: boolean) {
  const q = db.from('items').select('id, creator, title, external_id').eq('collection', 'vinyl')
  const { data: items } = force ? await q : await q.or('sort_name.is.null,tracklist.is.null')
  const result = { total: items?.length ?? 0, updated: 0 }
  for (const item of items ?? []) {
    try {
      let id = item.external_id
      if (!id) { id = await searchDiscogsId(item.creator, item.title); await delay(1100) }
      if (!id) continue
      const release = await fetchDiscogsRelease(id); await delay(1100)
      if (!release) continue
      const tracklist = (release.tracklist ?? []).map((t: Record<string, unknown>) => ({
        position: (t.position as string) || '',
        title: (t.title as string) || '',
        duration: (t.duration as string) || null,
      }))
      await db.from('items').update({
        sort_name: (release.artists_sort as string) || null,
        tracklist: tracklist.length ? tracklist : null,
        external_id: item.external_id ?? id,
      }).eq('id', item.id)
      result.updated++
    } catch { /* skip */ }
  }
  return result
}

// --- Books ---
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

async function backfillBooks(db: ReturnType<typeof createServerClient>, force: boolean) {
  const q = db.from('items').select('id, external_id').eq('collection', 'book').not('external_id', 'is', null)
  const { data: items } = force ? await q : await q.is('description', null)
  const result = { total: items?.length ?? 0, updated: 0 }
  for (const item of items ?? []) {
    const description = await fetchBookDescription(item.external_id)
    if (description) { await db.from('items').update({ description }).eq('id', item.id); result.updated++ }
    await delay(300)
  }
  return result
}

// --- Comics ---
async function backfillComics(db: ReturnType<typeof createServerClient>, force: boolean) {
  const q = db.from('items').select('id, external_id').eq('collection', 'comic').not('external_id', 'is', null)
  const { data: items } = force ? await q : await q.is('description', null)
  const result = { total: items?.length ?? 0, updated: 0 }
  for (const item of items ?? []) {
    try {
      const url = `https://comicvine.gamespot.com/api/volume/4050-${item.external_id}/?api_key=${process.env.COMICVINE_API_KEY}&format=json&field_list=deck,description`
      const res = await fetch(url, { headers: { 'User-Agent': 'FamilyMediaCollection/1.0', Accept: 'application/json' } })
      if (!res.ok) continue
      const data = await res.json()
      if (data.status_code !== 1) continue
      const deck = data.results?.deck as string | null
      const raw = data.results?.description as string | null
      const description = deck || (raw ? stripHtml(raw).slice(0, 1000) : null)
      if (description) { await db.from('items').update({ description }).eq('id', item.id); result.updated++ }
    } catch { /* skip */ }
    await delay(1100)
  }
  return result
}

// --- Lego ---
async function backfillLego(db: ReturnType<typeof createServerClient>, force: boolean) {
  const q = db.from('items').select('id, external_id, creator').eq('collection', 'lego').not('external_id', 'is', null)
  const { data: items } = force ? await q : await q.is('description', null)
  const result = { total: items?.length ?? 0, updated: 0 }

  // Fetch themes map once
  const themesMap = new Map<number, string>()
  try {
    const tr = await fetch(`https://rebrickable.com/api/v3/lego/themes/?page_size=1000&key=${process.env.REBRICKABLE_API_KEY}`)
    if (tr.ok) { const td = await tr.json(); for (const t of td.results ?? []) themesMap.set(t.id, t.name) }
  } catch { /* ignore */ }

  for (const item of items ?? []) {
    try {
      const res = await fetch(`https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(item.external_id)}/?key=${process.env.REBRICKABLE_API_KEY}`)
      if (!res.ok) continue
      const s = await res.json()
      const theme = themesMap.get(s.theme_id as number) ?? item.creator
      const description = s.set_num ? `Set ${s.set_num} · ${s.num_parts} parts` : null
      await db.from('items').update({ creator: theme, description, year: s.year ?? null }).eq('id', item.id)
      result.updated++
    } catch { /* skip */ }
    await delay(300)
  }
  return result
}

export async function GET(request: Request) {
  const { getSession } = await import('@/lib/session')
  const session = await getSession()
  if (session.role !== 'editor') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const params = new URL(request.url).searchParams
  const force = params.get('force') === 'true'
  const types = params.get('types')?.split(',') ?? ['vinyl', 'book', 'comic', 'lego']

  const db = createServerClient()
  const summary: Record<string, { total: number; updated: number }> = {}

  if (types.includes('vinyl')) summary.vinyl = await backfillVinyl(db, force)
  if (types.includes('book')) summary.book = await backfillBooks(db, force)
  if (types.includes('comic')) summary.comic = await backfillComics(db, force)
  if (types.includes('lego')) summary.lego = await backfillLego(db, force)

  return NextResponse.json({ force, types, summary })
}
