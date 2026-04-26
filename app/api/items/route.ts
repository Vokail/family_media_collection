import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
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
  const { memberSlug, collection, title, creator, year, cover_url, is_wishlist, external_id } = body
  const member = await getMemberBySlug(memberSlug)
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [cover_path, vinylRelease] = await Promise.all([
    cover_url
      ? import('@/lib/cover').then(m => m.downloadCover(cover_url, member.id))
      : Promise.resolve(null),
    collection === 'vinyl' && external_id
      ? import('@/lib/apis/discogs').then(m => m.fetchVinylRelease(external_id))
      : Promise.resolve(null),
  ])

  const item = await createItem({
    member_id: member.id,
    collection,
    title,
    creator,
    year,
    cover_path,
    is_wishlist: is_wishlist ?? false,
    notes: null,
    tracklist: vinylRelease?.tracklist?.length ? vinylRelease.tracklist : null,
    sort_name: vinylRelease?.sortName ?? null,
  })
  revalidatePath(`/${memberSlug}/${collection}`)
  return NextResponse.json(item, { status: 201 })
}
