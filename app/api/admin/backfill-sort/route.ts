import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

const DISCOGS_BASE = 'https://api.discogs.com'
const headers = () => ({
  Authorization: `Discogs token=${process.env.DISCOGS_API_KEY}`,
  'User-Agent': 'FamilyMediaCollection/1.0',
})

async function fetchSortName(creator: string, title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${creator} ${title}`)
    const searchRes = await fetch(`${DISCOGS_BASE}/database/search?q=${q}&type=release&format=vinyl&per_page=3`, { headers: headers() })
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const releaseId = searchData.results?.[0]?.id
    if (!releaseId) return null

    // Small delay to respect Discogs rate limit (60 req/min)
    await new Promise(r => setTimeout(r, 1100))

    const releaseRes = await fetch(`${DISCOGS_BASE}/releases/${releaseId}`, { headers: headers() })
    if (!releaseRes.ok) return null
    const releaseData = await releaseRes.json()
    return (releaseData.artists_sort as string) || null
  } catch {
    return null
  }
}

export async function GET() {
  const db = createServerClient()

  // Get all vinyl items without a sort_name
  const { data: items, error } = await db
    .from('items')
    .select('id, creator, title')
    .eq('collection', 'vinyl')
    .is('sort_name', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items?.length) return NextResponse.json({ message: 'Nothing to backfill', updated: 0 })

  const results: { id: string; creator: string; sort_name: string | null }[] = []

  for (const item of items) {
    const sort_name = await fetchSortName(item.creator, item.title)
    if (sort_name) {
      await db.from('items').update({ sort_name }).eq('id', item.id)
    }
    results.push({ id: item.id, creator: item.creator, sort_name })
    // Extra delay between items
    await new Promise(r => setTimeout(r, 1100))
  }

  return NextResponse.json({ updated: results.filter(r => r.sort_name).length, total: items.length, results })
}
