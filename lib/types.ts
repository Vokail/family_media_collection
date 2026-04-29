export type CollectionType = 'vinyl' | 'book' | 'comic' | 'lego'
export type Role = 'viewer' | 'editor' | 'member'

export interface Member {
  id: string
  name: string
  slug: string
  enabled_collections: CollectionType[]
}

export interface Track {
  position: string
  title: string
  duration: string | null
}

export interface Item {
  id: string
  member_id: string
  collection: CollectionType
  title: string
  creator: string
  year: number | null
  cover_path: string | null
  is_wishlist: boolean
  notes: string | null
  tracklist: Track[] | null
  sort_name: string | null
  external_id: string | null
  isbn: string | null
  description: string | null
  rating: number | null
  genres: string | null
  styles: string | null
  status: 'consumed' | null
  created_at: string
}

export interface Setting {
  key: 'view_pin_hash' | 'family_password_hash'
  value: string
}

export interface SearchResult {
  external_id: string
  isbn?: string | null
  title: string
  creator: string
  year: number | null
  cover_url: string | null
  source: 'openlibrary' | 'discogs' | 'comicvine' | 'rebrickable' | 'google'
  // Vinyl / Discogs extras
  format?: string | null       // e.g. "LP, Album"
  label?: string | null        // e.g. "Columbia"
  country?: string | null      // e.g. "UK"
  catno?: string | null        // e.g. "CBS 32100"
  description?: string | null  // short subtitle / series info
  genres?: string | null       // e.g. "Rock, Electronic"
  styles?: string | null       // e.g. "New Wave, Synth-pop"
}

export interface ActivityItem {
  id: string
  title: string
  creator: string
  collection: CollectionType
  cover_path: string | null
  created_at: string
  member_name: string
  member_slug: string
}

export interface SessionData {
  role?: Role
  editableMemberId?: string
}
