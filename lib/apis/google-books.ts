/**
 * Google Books API helpers.
 * Used by openlibrary.ts for book descriptions and ISBN cover resolution.
 */
import type { SearchResult } from '../types'
import { cleanDescription } from '../text-utils'

/** Fetch a book description from Google Books for a given query string. */
export async function googleBooksDescription(query: string, langRestrict?: string): Promise<string | null> {
  const langParam = langRestrict ? `&langRestrict=${langRestrict}` : ''
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1${langParam}`, { signal: AbortSignal.timeout(7000) })
  if (!res.ok) return null
  const data = await res.json()
  const desc = data.items?.[0]?.volumeInfo?.description as string | undefined
  if (!desc?.trim()) return null
  return cleanDescription(desc) || null
}

/** Resolve a SearchResult from Google Books by ISBN. Throws if not found. */
export async function googleBooksByISBN(isbn: string): Promise<SearchResult> {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error('not found')
  const data = await res.json()
  const vol = data.items?.[0]?.volumeInfo
  if (!vol) throw new Error('not found')
  return {
    external_id: `isbn:${isbn}`,
    isbn,
    title: vol.title as string,
    creator: (vol.authors as string[] | undefined)?.[0] ?? 'Unknown',
    year: vol.publishedDate ? parseInt(vol.publishedDate as string) : null,
    cover_url: (vol.imageLinks?.thumbnail as string | undefined)?.replace('http://', 'https://') ?? null,
    source: 'google' as SearchResult['source'],
  }
}
