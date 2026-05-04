import { NextResponse } from 'next/server'
import { searchBooks } from '@/lib/apis/openlibrary'
import { searchVinyl } from '@/lib/apis/discogs'
import { searchComics } from '@/lib/apis/comicvine'
import { searchLego } from '@/lib/apis/rebrickable'
import type { SearchResult } from '@/lib/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type')

  if (!q || !type) return NextResponse.json({ error: 'Missing q or type' }, { status: 400 })

  const lang = searchParams.get('lang') ?? undefined
  const offset = parseInt(searchParams.get('offset') ?? '0')

  let rawResults: SearchResult[]
  let hasMore: boolean | undefined

  if (type === 'vinyl') {
    const vinyl = await searchVinyl(q, offset)
    rawResults = vinyl.results
    hasMore = vinyl.hasMore
  } else if (type === 'book') {
    rawResults = await searchBooks(q, lang, offset)
  } else if (type === 'lego') {
    rawResults = await searchLego(q, offset)
  } else {
    rawResults = await searchComics(q, lang, offset)
  }

  const seen = new Set<string>()
  const unique = rawResults.filter(r => {
    const key = `${r.title.toLowerCase().trim()}||${r.creator.toLowerCase().trim()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json(hasMore !== undefined ? { results: unique, hasMore } : unique)
}
