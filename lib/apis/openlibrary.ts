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

async function olSearchByISBN(isbn: string): Promise<SearchResult> {
  const res = await fetch(`https://openlibrary.org/search.json?isbn=${isbn}&fields=key,title,author_name,first_publish_year,cover_i&limit=1`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error('not found')
  const data = await res.json()
  const doc = data.docs?.[0]
  if (!doc) throw new Error('not found')
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

async function olBibKeysByISBN(isbn: string): Promise<SearchResult> {
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error('not found')
  const data = await res.json()
  const book = data[`ISBN:${isbn}`]
  if (!book) throw new Error('not found')
  return {
    external_id: (book.key as string) ?? `isbn:${isbn}`,
    isbn,
    title: book.title as string,
    creator: (book.authors as { name: string }[])?.[0]?.name ?? 'Unknown',
    year: book.publish_date ? parseInt(book.publish_date as string) : null,
    cover_url: (book.cover as Record<string, string>)?.large ?? (book.cover as Record<string, string>)?.medium ?? null,
    source: 'openlibrary',
  }
}

async function googleBooksByISBN(isbn: string): Promise<SearchResult> {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error('not found')
  const data = await res.json()
  const vol = data.items?.[0]?.volumeInfo
  if (!vol) throw new Error('not found')
  return {
    external_id: `isbn:${isbn}`,
    isbn,
    title: vol.title as string,
    creator: (vol.authors as string[])?.[0] ?? 'Unknown',
    year: vol.publishedDate ? parseInt(vol.publishedDate) : null,
    cover_url: vol.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
    source: 'openlibrary',
  }
}

async function tryOLCoverByISBN(isbn: string): Promise<string | null> {
  try {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    // OL redirects missing covers to /b/id/-1-L.jpg (placeholder)
    if (res.url.includes('-1-L.jpg') || res.url.includes('id=-1')) return null
    return url
  } catch {
    return null
  }
}

async function tryGoogleBooksCoverByISBN(isbn: string): Promise<string | null> {
  try {
    const url = `https://books.google.com/books/content?vid=ISBN${isbn}&printsec=frontcover&img=1&zoom=3`
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    // Google returns a 1px transparent GIF (~43 bytes) when no cover exists
    const length = parseInt(res.headers.get('content-length') ?? '0')
    return length > 500 ? url : null
  } catch {
    return null
  }
}

export async function lookupBookByISBN(isbn: string): Promise<SearchResult | null> {
  try {
    // Race all three sources — fastest valid result wins
    const result = await Promise.any([
      olSearchByISBN(isbn),
      olBibKeysByISBN(isbn),
      googleBooksByISBN(isbn),
    ])
    // If no cover was returned, try OL cover endpoint directly by ISBN
    if (!result.cover_url) {
      result.cover_url = await tryOLCoverByISBN(isbn)
    }
    return result
  } catch {
    return null
  }
}
