export type CollectionType = 'vinyl' | 'book' | 'comic' | 'lego'
export type Role = 'viewer' | 'editor'

export interface Member {
  id: string
  name: string
  slug: string
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
}

export interface SessionData {
  role?: Role
}
