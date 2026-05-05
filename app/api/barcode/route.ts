import { NextResponse } from 'next/server'
import { lookupBookByISBN } from '@/lib/apis/openlibrary'
import { lookupVinylByBarcode } from '@/lib/apis/discogs'
import { lookupComicByBarcode } from '@/lib/apis/comicvine'
import { lookupLegoBySetNum, lookupLegoByEAN } from '@/lib/apis/rebrickable'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code') ?? ''
  const type = searchParams.get('type')

  if (!code || !type) return NextResponse.json({ error: 'Missing code or type' }, { status: 400 })

  const lang = searchParams.get('lang') ?? undefined

  // For lego: EAN barcodes (12-13 digits) go via upcitemdb → Rebrickable.
  // Shorter codes are typed set numbers — go straight to Rebrickable.
  async function lookupLego(c: string) {
    if (/^\d{12,13}$/.test(c)) {
      const result = await lookupLegoByEAN(c)
      if (result) return result
    }
    return lookupLegoBySetNum(c)
  }

  const result = type === 'vinyl' ? await lookupVinylByBarcode(code)
    : type === 'book' ? await lookupBookByISBN(code, lang)
    : type === 'lego' ? await lookupLego(code)
    : await lookupComicByBarcode(code, lang)

  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(result)
}
