import { NextResponse } from 'next/server'
import { searchBooks } from '@/lib/apis/openlibrary'
import { searchVinyl } from '@/lib/apis/discogs'
import { searchComics } from '@/lib/apis/comicvine'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type')

  if (!q || !type) return NextResponse.json({ error: 'Missing q or type' }, { status: 400 })

  const lang = searchParams.get('lang') ?? undefined
  const results = type === 'vinyl' ? await searchVinyl(q)
    : type === 'book' ? await searchBooks(q, lang)
    : await searchComics(q)

  const seen = new Set<string>()
  const unique = results.filter(r => {
    const key = `${r.title.toLowerCase().trim()}||${r.creator.toLowerCase().trim()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json(unique)
}
