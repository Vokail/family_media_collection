import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { importBolWishlist } from '@/lib/bol-import'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session.editableMemberId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { shareUrl } = body as { shareUrl?: string }

  if (!shareUrl || typeof shareUrl !== 'string' || !shareUrl.trim()) {
    return NextResponse.json({ error: 'Missing shareUrl' }, { status: 400 })
  }

  if (!shareUrl.includes('bol.com') || !shareUrl.includes('verlanglijstje')) {
    return NextResponse.json({ error: 'Invalid Bol.com wishlist URL' }, { status: 400 })
  }

  try {
    const result = await importBolWishlist(shareUrl.trim(), session.editableMemberId)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
