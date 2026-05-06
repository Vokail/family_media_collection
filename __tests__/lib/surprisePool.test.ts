import { getSurprisePool } from '@/lib/surprisePool'
import type { Item } from '@/lib/types'

const makeItem = (id: string, overrides: Partial<Item> = {}): Item => ({
  id,
  member_id: 'm1',
  collection: 'book',
  title: `Book ${id}`,
  creator: 'Author',
  year: 2020,
  cover_path: null,
  is_wishlist: false,
  notes: null,
  created_at: '',
  external_id: null,
  isbn: null,
  description: null,
  sort_name: null,
  rating: null,
  status: null,
  genres: null,
  styles: null,
  tracklist: null,
  lego_status: null,
  ...overrides,
})

const read1 = makeItem('r1', { status: 'consumed' })
const read2 = makeItem('r2', { status: 'consumed' })
const unread1 = makeItem('u1', { status: null })
const unread2 = makeItem('u2', { status: null })
const wish1 = makeItem('w1', { is_wishlist: true })

describe('getSurprisePool', () => {
  describe('when the filtered view has items', () => {
    it('returns the filtered (sorted) items — Read filter active', () => {
      const sorted = [read1, read2]
      const allItems = [read1, read2, unread1]
      expect(getSurprisePool(sorted, allItems, false)).toEqual([read1, read2])
    })

    it('returns the filtered (sorted) items — Unread filter active', () => {
      const sorted = [unread1, unread2]
      const allItems = [read1, unread1, unread2]
      expect(getSurprisePool(sorted, allItems, false)).toEqual([unread1, unread2])
    })

    it('returns the filtered items — All filter (sorted = all owned)', () => {
      const sorted = [read1, unread1]
      const allItems = [read1, unread1, wish1]
      expect(getSurprisePool(sorted, allItems, false)).toEqual([read1, unread1])
    })

    it('returns wishlist filtered items when on Wishlist tab', () => {
      const sorted = [wish1]
      const allItems = [read1, unread1, wish1]
      expect(getSurprisePool(sorted, allItems, true)).toEqual([wish1])
    })
  })

  describe('when the filtered view is empty (fallback)', () => {
    it('falls back to all owned items when Read filter has no results', () => {
      // sorted is empty because no items have status=consumed
      const sorted: Item[] = []
      const allItems = [unread1, unread2, wish1]
      const pool = getSurprisePool(sorted, allItems, false)
      // Should return all owned (non-wishlist) items
      expect(pool).toEqual([unread1, unread2])
      expect(pool).not.toContain(wish1)
    })

    it('falls back to all owned items when Unread filter has no results', () => {
      const sorted: Item[] = []
      const allItems = [read1, read2, wish1]
      const pool = getSurprisePool(sorted, allItems, false)
      expect(pool).toEqual([read1, read2])
      expect(pool).not.toContain(wish1)
    })

    it('falls back to all wishlist items when on Wishlist tab with empty filter', () => {
      const sorted: Item[] = []
      const allItems = [read1, wish1, makeItem('w2', { is_wishlist: true })]
      const pool = getSurprisePool(sorted, allItems, true)
      expect(pool.every(i => i.is_wishlist)).toBe(true)
      expect(pool).toHaveLength(2)
    })

    it('returns empty array when there are truly no items at all', () => {
      expect(getSurprisePool([], [], false)).toEqual([])
    })
  })
})
