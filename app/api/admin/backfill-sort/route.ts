import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { downloadCover } from '@/lib/cover'
import { fetchBookDescription } from '@/lib/apis/openlibrary'
import { fetchComicDescription } from '@/lib/apis/comicvine'

const DISCOGS_BASE = 'https://api.discogs.com'
const discogsHeaders = () => ({
  Authorization: `Discogs token=${process.env.DISCOGS_API_KEY}`,
  'User-Agent': 'FamilyMediaCollection/1.0',
})

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function findBookCoverUrl(external_id: string | null, isbn: string | null): Promise<string | null> {
  const isbnVal = isbn ?? (external_id?.startsWith('isbn:') ? external_id.slice(5) : null)
  // Only use covers explicitly returned by APIs — avoids bad/black placeholder images
  if (isbnVal) {
    try {
      const { lookupBookByISBN } = await import('@/lib/apis/openlibrary')
      const result = await lookupBookByISBN(isbnVal)
      if (result?.cover_url) return result.cover_url
    } catch { /* skip */ }
  }
  return null
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
  const q = db.from('items').select('id, creator, title, external_id, cover_path, member_id, sort_name, tracklist, genres, styles').eq('collection', 'vinyl')
  const { data: allItems } = await q
  const items = force
    ? (allItems ?? [])
    : (allItems ?? []).filter(i => !i.sort_name || !i.tracklist || !i.cover_path || !i.genres)
  const result = { total: items.length, updated: 0 }
  for (const item of items) {
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
      const patch: Record<string, unknown> = {
        sort_name: (release.artists_sort as string) || null,
        tracklist: tracklist.length ? tracklist : null,
        external_id: item.external_id ?? id,
        genres: (release.genres as string[])?.join(', ') || null,
        styles: (release.styles as string[])?.join(', ') || null,
      }
      if (!item.cover_path) {
        const coverUrl = (release.images as { uri: string }[])?.[0]?.uri ?? null
        if (coverUrl) {
          const path = await downloadCover(coverUrl, item.member_id)
          if (path) patch.cover_path = path
        }
      }
      await db.from('items').update(patch).eq('id', item.id)
      result.updated++
    } catch { /* skip */ }
  }
  return result
}

// --- Books ---
async function searchBookExternalId(title: string, creator: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${title} ${creator}`)
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=key&limit=1`)
    if (!res.ok) return null
    const data = await res.json()
    return (data.docs?.[0]?.key as string) ?? null
  } catch { return null }
}

async function fetchBookIsbn(worksKey: string): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org${worksKey}/editions.json?limit=10`)
    if (!res.ok) return null
    const data = await res.json()
    for (const edition of data.entries ?? []) {
      const isbn13 = (edition.isbn_13 as string[])?.[0]
      if (isbn13) return isbn13
      const isbn10 = (edition.isbn_10 as string[])?.[0]
      if (isbn10) return isbn10
    }
    return null
  } catch { return null }
}

async function backfillBooks(db: ReturnType<typeof createServerClient>, force: boolean) {
  const { data: allItems } = await db.from('items').select('id, title, creator, external_id, description, isbn, cover_path, member_id').eq('collection', 'book')
  const fullItems = force
    ? (allItems ?? [])
    : (allItems ?? []).filter(i => !i.description || !i.isbn || !i.cover_path)
  const result = { total: fullItems.length, updated: 0 }
  for (const item of fullItems) {
    let worksKey = item.external_id?.startsWith('/works/') ? item.external_id : null
    let isbn = item.isbn ?? (item.external_id?.startsWith('isbn:') ? item.external_id.slice(5) : null)

    if (!worksKey) {
      worksKey = await searchBookExternalId(item.title, item.creator)
      await delay(300)
      // Don't skip — we can still try cover by ISBN even if OL has no works entry
    }

    const patch: Record<string, unknown> = {}
    if (worksKey) patch.external_id = worksKey

    if (worksKey) {
      // Fetch isbn first so description lookup can use it for Google Books
      if (!isbn) {
        isbn = await fetchBookIsbn(worksKey)
        await delay(300)
      }
      if (force || !item.description) {
        // Infer language from ISBN prefix: Dutch ISBNs start with 90- or 978-90
        const inferredLang = isbn && (isbn.startsWith('90') || isbn.startsWith('978-90') || isbn.startsWith('9789') || isbn.startsWith('9790')) ? 'dutch' : null
        const description = await fetchBookDescription(worksKey, isbn, inferredLang, item.title, item.creator)
        await delay(300)
        if (description) patch.description = description
      }
    }
    if (isbn) patch.isbn = isbn

    if (!item.cover_path) {
      const coverUrl = await findBookCoverUrl(worksKey, isbn ?? null)
      if (coverUrl) {
        const path = await downloadCover(coverUrl, item.member_id)
        if (path) patch.cover_path = path
      }
    }

    if (Object.keys(patch).length > 0) {
      await db.from('items').update(patch).eq('id', item.id)
      result.updated++
    }
  }
  return result
}

// --- Comics ---
async function searchComicExternalId(title: string): Promise<string | null> {
  try {
    const url = `https://comicvine.gamespot.com/api/search/?api_key=${process.env.COMICVINE_API_KEY}&format=json&query=${encodeURIComponent(title)}&resources=volume&field_list=id&limit=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'FamilyMediaCollection/1.0', Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    const id = data.results?.[0]?.id
    return id ? String(id) : null
  } catch { return null }
}


async function fetchComicCoverUrl(externalId: string): Promise<string | null> {
  try {
    const url = `https://comicvine.gamespot.com/api/volume/4050-${externalId}/?api_key=${process.env.COMICVINE_API_KEY}&format=json&field_list=image`
    const res = await fetch(url, { headers: { 'User-Agent': 'FamilyMediaCollection/1.0', Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    return (data.results?.image as Record<string, string>)?.medium_url ?? null
  } catch { return null }
}

async function backfillComics(db: ReturnType<typeof createServerClient>, force: boolean) {
  const { data: allItems } = await db.from('items').select('id, title, creator, external_id, description, isbn, cover_path, member_id').eq('collection', 'comic')
  const fullItems = force
    ? (allItems ?? [])
    : (allItems ?? []).filter(i => !i.external_id || !i.cover_path || !i.description)
  const result = { total: fullItems.length, updated: 0 }
  for (const item of fullItems) {
    try {
      const isIsbnBased = item.external_id && !(/^\d+$/.test(item.external_id))
      let externalId = item.external_id

      // Only search ComicVine for items without any external_id
      if (!externalId) {
        externalId = await searchComicExternalId(item.title)
        await delay(1100)
        if (!externalId) continue
      }

      const patch: Record<string, unknown> = { external_id: externalId }

      if (!item.cover_path) {
        // ISBN-based comics (manga) don't have ComicVine cover — skip
        if (!isIsbnBased) {
          const coverUrl = await fetchComicCoverUrl(externalId)
          await delay(1100)
          if (coverUrl) {
            const path = await downloadCover(coverUrl, item.member_id)
            if (path) patch.cover_path = path
          }
        }
      }

      if (force || !item.description) {
        let description: string | null = null
        if (isIsbnBased) {
          const inferredLang = item.isbn && (item.isbn.startsWith('90') || item.isbn.startsWith('9789') || item.isbn.startsWith('9790')) ? 'dutch' : null
          description = await fetchBookDescription(externalId, item.isbn, inferredLang, item.title, item.creator)
        } else {
          description = await fetchComicDescription(externalId)
        }
        await delay(1100)
        if (description) patch.description = description
      }

      if (item.isbn) patch.isbn = item.isbn

      if (Object.keys(patch).length > 1) {
        await db.from('items').update(patch).eq('id', item.id)
        result.updated++
      }
    } catch { /* skip */ }
  }
  return result
}

// --- Lego ---
async function searchLegoSetNum(title: string): Promise<string | null> {
  try {
    const res = await fetch(`https://rebrickable.com/api/v3/lego/sets/?search=${encodeURIComponent(title)}&page_size=1&key=${process.env.REBRICKABLE_API_KEY}`)
    if (!res.ok) return null
    const data = await res.json()
    return (data.results?.[0]?.set_num as string) ?? null
  } catch { return null }
}

async function backfillLego(db: ReturnType<typeof createServerClient>, force: boolean) {
  const { data: allItems } = await db.from('items').select('id, title, external_id, creator, description, cover_path, member_id, locked_fields').eq('collection', 'lego')
  const items = force
    ? (allItems ?? [])
    : (allItems ?? []).filter(i => !i.description)
  const result = { total: items.length, updated: 0 }

  // Fetch themes map once
  const themesMap = new Map<number, string>()
  try {
    const tr = await fetch(`https://rebrickable.com/api/v3/lego/themes/?page_size=1000&key=${process.env.REBRICKABLE_API_KEY}`)
    if (tr.ok) { const td = await tr.json(); for (const t of td.results ?? []) themesMap.set(t.id, t.name) }
  } catch { /* ignore */ }

  for (const item of items) {
    try {
      let setNum = item.external_id
      if (!setNum) {
        setNum = await searchLegoSetNum(item.title)
        await delay(300)
        if (!setNum) continue
      }
      const res = await fetch(`https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(setNum)}/?key=${process.env.REBRICKABLE_API_KEY}`)
      if (!res.ok) continue
      const s = await res.json()
      const theme = (themesMap.get(s.theme_id as number) ?? item.creator).replace(/\s+and\s+CUUSOO$/i, '')
      const description = s.set_num ? `Set ${s.set_num} · ${s.num_parts} parts` : null
      const locked: string[] = item.locked_fields ?? []
      const patch: Record<string, unknown> = { description, external_id: setNum }
      // Respect manually locked fields — don't overwrite creator or year if user edited them
      if (!locked.includes('creator')) patch.creator = theme
      if (!locked.includes('year')) patch.year = s.year ?? null
      if (!item.cover_path && s.set_img_url) {
        const path = await downloadCover(s.set_img_url as string, item.member_id)
        if (path) patch.cover_path = path
      }
      await db.from('items').update(patch).eq('id', item.id)
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
