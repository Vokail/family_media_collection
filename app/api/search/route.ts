import { NextResponse } from 'next/server'
import { searchBooks } from '@/lib/apis/openlibrary'
import { searchVinyl } from '@/lib/apis/discogs'
import { searchComics } from '@/lib/apis/comicvine'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const type = searchParams.get('type')

  if (!q || !type) return NextResponse.json({ error: 'Missing q or type' }, { status: 400 })

  const results = type === 'vinyl' ? await searchVinyl(q)
    : type === 'book' ? await searchBooks(q)
    : await searchComics(q)

  return NextResponse.json(results)
}
