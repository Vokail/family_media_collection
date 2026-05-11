/**
 * KB (Koninklijke Bibliotheek / National Library of the Netherlands) SRU API.
 * Used by openlibrary.ts as a preferred source for Dutch ISBN lookups.
 */
import type { SearchResult } from '../types'

/** Resolve a SearchResult from the KB SRU endpoint by ISBN. Throws if not found. */
export async function kbSruByISBN(isbn: string): Promise<SearchResult> {
  const url = `https://jsru.kb.nl/sru/sru?operation=searchRetrieve&x-collection=GGC&query=isbn+exact+%22${isbn}%22&recordSchema=dc&maximumRecords=1`
  const res = await fetch(url, { signal: AbortSignal.timeout(9000) })
  if (!res.ok) throw new Error('not found')
  const xml = await res.text()
  const count = xml.match(/<srw:numberOfRecords>(\d+)<\/srw:numberOfRecords>/)?.[1]
  if (!count || parseInt(count) === 0) throw new Error('not found')
  const dc = (tag: string) => xml.match(new RegExp(`<dc:${tag}[^>]*>([^<]+)<\\/dc:${tag}>`, 'i'))?.[1]?.trim() ?? null
  const title = dc('title')
  if (!title) throw new Error('not found')
  return {
    external_id: `isbn:${isbn}`,
    isbn,
    title,
    creator: dc('creator') ?? 'Unknown',
    year: (() => { const d = dc('date'); return d ? parseInt(d) : null })(),
    cover_url: null,
    source: 'kb',
  }
}
