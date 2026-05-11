/**
 * getDupeStatus — checks whether a search result is already in the user's
 * collection, using two lookup maps built from existing items.
 *
 * Extracted from AddItemPage (#125) so it can be shared with SearchPane and
 * unit-tested in isolation without duplicating the logic in the test file.
 */
import type { Item, SearchResult } from './types'

export type DupeMap = {
  byId: Map<string, 'owned' | 'wishlist'>
  byTitle: Map<string, 'owned' | 'wishlist'>
}

export function makeDupeMap(existingItems: Pick<Item, 'external_id' | 'title' | 'creator' | 'is_wishlist'>[]): DupeMap {
  const byId = new Map<string, 'owned' | 'wishlist'>()
  const byTitle = new Map<string, 'owned' | 'wishlist'>()
  for (const item of existingItems) {
    const status = item.is_wishlist ? 'wishlist' : 'owned'
    if (item.external_id) byId.set(item.external_id, status)
    byTitle.set(`${item.title.toLowerCase().trim()}|${item.creator.toLowerCase().trim()}`, status)
  }
  return { byId, byTitle }
}

/**
 * Returns 'owned', 'wishlist', or null.
 *
 * Priority:
 * 1. Exact external_id match — most precise.
 * 2. For Rebrickable and Discogs, skip the title fallback after a non-match —
 *    their IDs are globally unique, so a different ID means a different item.
 * 3. Title + creator fallback for sources without reliable global IDs
 *    (OpenLibrary, ComicVine).
 */
export function getDupeStatus(
  result: Pick<SearchResult, 'external_id' | 'title' | 'creator' | 'source'>,
  dupeMap: DupeMap,
): 'owned' | 'wishlist' | null {
  if (result.external_id) {
    const s = dupeMap.byId.get(result.external_id)
    if (s) return s
    if (result.source === 'rebrickable' || result.source === 'discogs') return null
  }
  const key = `${result.title.toLowerCase().trim()}|${result.creator.toLowerCase().trim()}`
  return dupeMap.byTitle.get(key) ?? null
}
