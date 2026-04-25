import { NextResponse } from 'next/server'
import { lookupBookByISBN } from '@/lib/apis/openlibrary'
import { lookupVinylByBarcode } from '@/lib/apis/discogs'
import { lookupComicByBarcode } from '@/lib/apis/comicvine'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code') ?? ''
  const type = searchParams.get('type')

  if (!code || !type) return NextResponse.json({ error: 'Missing code or type' }, { status: 400 })

  const result = type === 'vinyl' ? await lookupVinylByBarcode(code)
    : type === 'book' ? await lookupBookByISBN(code)
    : await lookupComicByBarcode(code)

  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(result)
}
