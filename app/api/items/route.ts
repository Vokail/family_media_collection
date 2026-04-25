import { NextResponse } from 'next/server'
import { listItems, createItem } from '@/lib/db/items'
import { getMemberBySlug } from '@/lib/db/members'
import type { CollectionType } from '@/lib/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('member')!
  const collection = searchParams.get('collection') as CollectionType
  const isWishlist = searchParams.get('wishlist') === 'true'
  const member = await getMemberBySlug(slug)
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const items = await listItems(member.id, collection, isWishlist)
  return NextResponse.json(items)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { memberSlug, collection, title, creator, year, cover_url, is_wishlist } = body
  const member = await getMemberBySlug(memberSlug)
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let cover_path: string | null = null
  if (cover_url) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { downloadCover } = await import('@/lib/cover' as any)
    cover_path = await downloadCover(cover_url, member.id)
  }

  const item = await createItem({
    member_id: member.id,
    collection,
    title,
    creator,
    year,
    cover_path,
    is_wishlist: is_wishlist ?? false,
    notes: null,
  })
  return NextResponse.json(item, { status: 201 })
}
