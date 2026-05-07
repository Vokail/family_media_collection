/**
 * Test fixtures used by the MSW handlers. Kept in one place so test specs and
 * handlers can stay in sync.
 */
import type { Item, Member } from '@/lib/types'

export const FIXTURE_MEMBERS: Member[] = [
  { id: 'm-alice',   name: 'Alice',   slug: 'alice',   avatar_path: null, enabled_collections: ['vinyl', 'book', 'comic', 'lego'] },
  { id: 'm-bob',     name: 'Bob',     slug: 'bob',     avatar_path: null, enabled_collections: ['vinyl', 'book', 'comic', 'lego'] },
  { id: 'm-charlie', name: 'Charlie', slug: 'charlie', avatar_path: null, enabled_collections: ['vinyl', 'book', 'comic', 'lego'] },
  { id: 'm-dana',    name: 'Dana',    slug: 'dana',    avatar_path: null, enabled_collections: ['vinyl', 'book', 'comic', 'lego'] },
]

const isoDay = (offset: number) => new Date(Date.UTC(2026, 0, 1 + offset)).toISOString()

const baseItem = (id: string, overrides: Partial<Item> & Pick<Item, 'title' | 'creator'>): Item => ({
  id,
  member_id: 'm-alice',
  collection: 'vinyl',
  year: 1970,
  cover_path: null,
  is_wishlist: false,
  notes: null,
  external_id: null,
  isbn: null,
  sort_name: null,
  rating: null,
  description: null,
  tracklist: null,
  status: null,
  genres: null,
  styles: null,
  condition: null,
  lego_status: null,
  locked_fields: null,
  created_at: isoDay(0),
  ...overrides,
})

// 6 vinyl albums spread across letters A/B/T/N/# so the title-sorted sidebar
// has something interesting to scroll between (used by the #117 regression test).
export const FIXTURE_ITEMS: Item[] = [
  baseItem('i-1', { title: 'Abbey Road',          creator: 'The Beatles',    year: 1969, created_at: isoDay(1) }),
  baseItem('i-2', { title: 'Born To Run',         creator: 'Bruce Springsteen', year: 1975, created_at: isoDay(2) }),
  baseItem('i-3', { title: 'Animals',             creator: 'Pink Floyd',     year: 1977, created_at: isoDay(3) }),
  baseItem('i-4', { title: 'The Wall',            creator: 'Pink Floyd',     year: 1979, created_at: isoDay(4) }),
  baseItem('i-5', { title: 'A Night At The Opera',creator: 'Queen',          year: 1975, created_at: isoDay(5) }),
  baseItem('i-6', { title: '1984',                creator: 'Van Halen',      year: 1984, created_at: isoDay(6) }),
]
