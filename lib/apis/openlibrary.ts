import type { SearchResult } from '../types'

function mapDoc(doc: Record<string, unknown>): SearchResult {
  return {
    external_id: doc.key as string,
    title: doc.title as string,
    creator: (doc.author_name as string[])?.[0] ?? 'Unknown',
    year: (doc.first_publish_year as number) ?? null,
    cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    source: 'openlibrary',
  }
}

const OL_LANG_CODES: Record<string, string> = {
  dutch: 'dut',
  english: 'eng',
  french: 'fre',
  german: 'ger',
}

export async function searchBooks(query: string, lang?: string, offset = 0): Promise<SearchResult[]> {
  const langCode = lang && lang !== 'all' ? OL_LANG_CODES[lang] : undefined
  const langParam = langCode ? `&language=${langCode}` : ''
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,first_publish_year,cover_i&limit=20&offset=${offset}${langParam}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.docs ?? []).map(mapDoc)
}

export async function fetchBookDescription(externalId: string): Promise<string | null> {
  try {
    // externalId is either "/works/OL1234W" or "isbn:..."
    const workId = externalId.startsWith('/works/') ? externalId : null
    if (!workId) return null
    const res = await fetch(`https://openlibrary.org${workId}.json`)
    if (!res.ok) return null
    const data = await res.json()
    const desc = data.description
    if (!desc) return null
    return typeof desc === 'string' ? desc : (desc.value as string) ?? null
  } catch {
    return null
  }
}

export async function lookupBookByISBN(isbn: string): Promise<SearchResult | null> {
  // 1. OpenLibrary search-by-ISBN — returns works key for description backfill
  try {
    const res = await fetch(`https://openlibrary.org/search.json?isbn=${isbn}&fields=key,title,author_name,first_publish_year,cover_i&limit=1`)
    if (res.ok) {
      const data = await res.json()
      const doc = data.docs?.[0]
      if (doc) {
        return {
          external_id: (doc.key as string) ?? `isbn:${isbn}`,
          isbn,
          title: doc.title as string,
          creator: (doc.author_name as string[])?.[0] ?? 'Unknown',
          year: (doc.first_publish_year as number) ?? null,
          cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
          source: 'openlibrary',
        }
      }
    }
  } catch { /* fall through */ }

  // 2. Google Books — comprehensive ISBN database, no API key needed
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`)
    if (res.ok) {
      const data = await res.json()
      const vol = data.items?.[0]?.volumeInfo
      if (vol) {
        const cover = vol.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null
        return {
          external_id: `isbn:${isbn}`,
          isbn,
          title: vol.title as string,
          creator: (vol.authors as string[])?.[0] ?? 'Unknown',
          year: vol.publishedDate ? parseInt(vol.publishedDate) : null,
          cover_url: cover,
          source: 'openlibrary',
        }
      }
    }
  } catch { /* fall through */ }

  // 3. OpenLibrary books API — slowest but most detailed
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`)
    if (!res.ok) return null
    const data = await res.json()
    const book = data[`ISBN:${isbn}`]
    if (!book) return null
    const worksKey: string | null = book.works?.[0]?.key ?? null
    return {
      external_id: worksKey ?? `isbn:${isbn}`,
      isbn,
      title: book.title,
      creator: book.authors?.[0]?.name ?? 'Unknown',
      year: book.publish_date ? parseInt(book.publish_date) : null,
      cover_url: book.cover?.large ?? null,
      source: 'openlibrary',
    }
  } catch { return null }
}
