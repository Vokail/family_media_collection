import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { listItems, createItem } from '@/lib/db/items'
import { getMemberBySlug } from '@/lib/db/members'
import { getSession } from '@/lib/session'
import type { CollectionType } from '@/lib/types'

const VALID_COLLECTIONS: CollectionType[] = ['vinyl', 'book', 'comic', 'lego']

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('member')
  const collection = searchParams.get('collection') as CollectionType
  if (!slug) return NextResponse.json({ error: 'member param required' }, { status: 400 })
  if (!VALID_COLLECTIONS.includes(collection)) {
    return NextResponse.json({ error: 'Invalid collection' }, { status: 400 })
  }
  const wishlistParam = searchParams.get('wishlist')
  const isWishlist = wishlistParam === null ? undefined : wishlistParam === 'true'
  try {
    const member = await getMemberBySlug(slug)
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const items = await listItems(member.id, collection, isWishlist)
    return NextResponse.json(items)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const { memberSlug, collection, title, creator, year, cover_url, is_wishlist, external_id, isbn, lang, genres, styles } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  if (!VALID_COLLECTIONS.includes(collection)) return NextResponse.json({ error: 'Invalid collection' }, { status: 400 })
  try {
  const [member, session] = await Promise.all([getMemberBySlug(memberSlug), getSession()])
  if (!session.role) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (session.role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.role === 'member' && session.editableMemberId !== member.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const comicDescription = collection === 'comic' && external_id
    ? /^\d+$/.test(external_id)
      ? import('@/lib/apis/comicvine').then(m => m.fetchComicDescription(external_id))
      : import('@/lib/apis/openlibrary').then(m => m.fetchBookDescription(external_id, isbn, lang, title, creator))
    : Promise.resolve(null)

  const [cover_path, vinylRelease, description] = await Promise.all([
    cover_url
      ? import('@/lib/cover').then(m => m.downloadCover(cover_url, member.id))
      : Promise.resolve(null),
    collection === 'vinyl' && external_id
      ? import('@/lib/apis/discogs').then(m => m.fetchVinylRelease(external_id))
      : Promise.resolve(null),
    collection === 'book' && external_id
      ? import('@/lib/apis/openlibrary').then(m => m.fetchBookDescription(external_id, isbn, lang, title, creator))
      : comicDescription,
  ])

  const item = await createItem({
    member_id: member.id,
    collection,
    title: title.trim(),
    creator,
    year,
    cover_path,
    is_wishlist: is_wishlist ?? false,
    notes: null,
    tracklist: vinylRelease?.tracklist?.length ? vinylRelease.tracklist : null,
    sort_name: vinylRelease?.sortName ?? null,
    external_id: external_id ?? null,
    isbn: isbn ?? null,
    description: description ?? null,
    rating: null,
    // Genre/style from Discogs: prefer release-level data, fall back to search result
    genres: vinylRelease?.genres ?? genres ?? null,
    styles: vinylRelease?.styles ?? styles ?? null,
    status: null,
    lego_status: null,
    locked_fields: null,
  })
  revalidatePath(`/${memberSlug}/${collection}`)
  return NextResponse.json(item, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
