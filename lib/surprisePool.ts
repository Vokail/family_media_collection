import type { Item } from './types'

/**
 * Returns the pool of items the Surprise button should pick from.
 *
 * Rules (in priority order):
 * 1. If the current filtered view (sorted) has items → pick from those.
 *    This respects whatever status/lego filter the user has active.
 * 2. If the filtered view is empty (e.g. "Read" filter but nothing read yet)
 *    → fall back to all items in the current owned/wishlist tab,
 *    ignoring the status filter so the user always gets a pick.
 */
export function getSurprisePool(sorted: Item[], items: Item[], isWishlist: boolean): Item[] {
  if (sorted.length > 0) return sorted
  return items.filter(i => i.is_wishlist === isWishlist)
}
