import type { CollectionType } from './types'
import { listItems, createItem } from './db/items'
import { downloadCover } from './cover'
import { lookupVinylByBarcode, searchVinyl } from './apis/discogs'
import { lookupBookByISBN, searchBooks } from './apis/openlibrary'

const BOL_BASE = 'https://www.bol.com'
const USER_AGENT = 'Mozilla/5.0 (compatible; FamilyMediaCollection/1.0)'

export interface BolWishlistItem {
  title: string
  productId: string
  productUrl: string
  bolCoverUrl: string | null
}

export interface BolProductDetail {
  eans: string[]
  collectionType: CollectionType | null
}

export interface ImportResult {
  imported: number
  skipped: { title: string; reason: string }[]
}

export async function scrapeWishlist(shareUrl: string): Promise<BolWishlistItem[]> {
  const url = shareUrl.endsWith('/') ? shareUrl : shareUrl + '/'
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Bol.com wishlist fetch failed: ${res.status}`)
  const html = await res.text()

  const seen = new Set<string>()
  const items: BolWishlistItem[] = []

  for (const m of Array.from(html.matchAll(/href="(\/nl\/nl\/p\/[^/]+\/(\d+)\/)/g))) {
    const [, productPath, id] = m
    if (seen.has(id)) continue
    seen.add(id)

    // Title: find break-words span after the first occurrence of this product ID
    const pos = html.indexOf(`/${id}/`)
    const chunk = html.slice(pos, pos + 800)
    const titleMatch = chunk.match(/<span class="break-words">([^<]+)<\/span>/)
    const title = titleMatch ? titleMatch[1].trim() : id

    // Cover: first media.s-bol.com image in the same chunk
    const coverMatch = chunk.match(/https:\/\/media\.s-bol\.com\/[^\s"]+\.jpg/)

    items.push({
      title,
      productId: id,
      productUrl: `${BOL_BASE}${productPath}`,
      bolCoverUrl: coverMatch ? coverMatch[0] : null,
    })
  }

  return items
}

export async function scrapeProductDetail(productUrl: string): Promise<BolProductDetail> {
  try {
    const res = await fetch(productUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { eans: [], collectionType: null }
    const html = await res.text()

    // All gtin13/ean values from structured data
    const eans = Array.from(
      new Set(
        Array.from(html.matchAll(/"(?:gtin13|ean)","value":"([0-9]{12,14})"/g)).map(m => m[1])
      )
    )

    // Collection type from JSON-LD @type — collect all, prefer MusicAlbum/Book
    const types = Array.from(html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)).map(m => m[1])
    let collectionType: CollectionType | null = null
    if (types.includes('MusicAlbum')) collectionType = 'vinyl'
    else if (types.includes('Book')) collectionType = 'book'

    return { eans, collectionType }
  } catch {
    return { eans: [], collectionType: null }
  }
}

export async function importBolWishlist(
  shareUrl: string,
  memberId: string,
): Promise<ImportResult> {
  const wishlistItems = await scrapeWishlist(shareUrl)
  const result: ImportResult = { imported: 0, skipped: [] }

  // Cache existing items per collection to avoid repeated DB calls
  const existingCache: Partial<Record<CollectionType, string[]>> = {}
  async function existingTitles(collection: CollectionType): Promise<string[]> {
    if (!existingCache[collection]) {
      const rows = await listItems(memberId, collection)
      existingCache[collection] = rows.map(r => r.title.toLowerCase())
    }
    return existingCache[collection]!
  }

  for (const item of wishlistItems) {
    // Fetch product detail (type + EANs)
    const detail = await scrapeProductDetail(item.productUrl)

    if (!detail.collectionType) {
      result.skipped.push({ title: item.title, reason: 'unknown type' })
      continue
    }

    const { collectionType, eans } = detail

    // Dedup: skip if title already exists in this collection (owned or wishlist)
    const existing = await existingTitles(collectionType)
    if (existing.includes(item.title.toLowerCase())) {
      result.skipped.push({ title: item.title, reason: 'already in collection' })
      continue
    }

    // Find metadata via EAN lookup, fall back to title search
    let searchResult: Awaited<ReturnType<typeof lookupVinylByBarcode>> = null

    if (collectionType === 'vinyl') {
      for (const ean of eans) {
        searchResult = await lookupVinylByBarcode(ean)
        if (searchResult) break
      }
      if (!searchResult) {
        const { results } = await searchVinyl(item.title)
        searchResult = results[0] ?? null
      }
    } else if (collectionType === 'book') {
      for (const ean of eans) {
        searchResult = await lookupBookByISBN(ean)
        if (searchResult) break
      }
      if (!searchResult) {
        const results = await searchBooks(item.title)
        searchResult = results[0] ?? null
      }
    }

    // Download cover: API result first, Bol image as fallback
    const coverUrl = searchResult?.cover_url ?? item.bolCoverUrl
    const cover_path = coverUrl ? await downloadCover(coverUrl, memberId) : null

    await createItem({
      member_id: memberId,
      collection: collectionType,
      title: searchResult?.title ?? item.title,
      creator: searchResult?.creator ?? '',
      year: searchResult?.year ?? null,
      cover_path,
      is_wishlist: true,
      notes: null,
      tracklist: null,
      sort_name: null,
      external_id: searchResult?.external_id ?? null,
      isbn: searchResult?.isbn ?? null,
      description: null,
      rating: null,
      genres: null,
      styles: null,
      status: null,
      lego_status: null,
      condition: null,
      locked_fields: null,
    })

    // Update cache so subsequent items in the same import don't duplicate
    existingCache[collectionType]?.push((searchResult?.title ?? item.title).toLowerCase())

    result.imported++
  }

  return result
}
