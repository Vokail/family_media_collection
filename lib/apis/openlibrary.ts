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
    source: 'google' as SearchResult['source'],
  }
}

async function kbSruByISBN(isbn: string): Promise<SearchResult> {
  const url = `https://jsru.kb.nl/sru/sru?operation=searchRetrieve&x-collection=GGC&query=isbn+exact+%22${isbn}%22&recordSchema=dc&maximumRecords=1`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
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
    source: 'openlibrary',
  }
}


export async function lookupBookByISBN(isbn: string, lang?: string): Promise<SearchResult | null> {
  try {
    if (lang === 'dutch') {
      // For Dutch ISBNs:
      // - Skip olSearchByISBN: it returns work-level data and may surface the English
      //   original title instead of the Dutch edition title.
      // - Run kbSruByISBN (Koninklijke Bibliotheek — authoritative for NL editions)
      //   and edition-level sources in parallel; prefer whichever resolves first.
      return await Promise.any([
        kbSruByISBN(isbn),
        olBibKeysByISBN(isbn),
        googleBooksByISBN(isbn),
      ])
    }
    // Default: race all sources — fastest valid result wins
    return await Promise.any([
      olSearchByISBN(isbn),
      olBibKeysByISBN(isbn),
      googleBooksByISBN(isbn),
      kbSruByISBN(isbn),
    ])
  } catch {
    return null
  }
}
