/**
 * Search-box placeholders per collection (#151).
 *
 * Both search bars said "title or artist" for every collection, which is wrong
 * for three of the four: Lego sets have a theme ("Icons", "Creator Expert"),
 * and books and comics have an author. Single source of truth shared by
 * CollectionGrid (filtering an existing collection) and SearchPane (searching
 * an external catalogue to add something).
 *
 * Both search the same two fields — title and creator — so the wording only has
 * to name what `creator` holds for that collection.
 */
import type { CollectionType } from './types'

/** What the `creator` column means to a reader of this collection. */
export function creatorLabel(collection: CollectionType): string {
  switch (collection) {
    case 'lego': return 'theme'
    case 'book':
    case 'comic': return 'author'
    default: return 'artist'
  }
}

/** Placeholder for filtering a collection you already own. */
export function collectionSearchPlaceholder(collection: CollectionType): string {
  return collection === 'lego'
    ? 'Search set or theme…'
    : `Search title or ${creatorLabel(collection)}…`
}

/**
 * Placeholder for the add-item search.
 *
 * Vinyl is the exception: it has a dedicated Artist field beside this one, so
 * naming the artist here too would suggest both belong in the same box.
 */
export function addSearchPlaceholder(collection: CollectionType): string {
  if (collection === 'vinyl') return 'Album title…'
  return collectionSearchPlaceholder(collection)
}
