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

export async function searchBooks(query: string, lang?: string): Promise<SearchResult[]> {
  const langCode = lang && lang !== 'all' ? OL_LANG_CODES[lang] : undefined
  const langParam = langCode ? `&language=${langCode}` : ''
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=key,title,author_name,first_publish_year,cover_i&limit=10${langParam}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.docs ?? []).map(mapDoc)
}

export async function lookupBookByISBN(isbn: string): Promise<SearchResult | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const book = data[`ISBN:${isbn}`]
  if (!book) return null
  return {
    external_id: `isbn:${isbn}`,
    title: book.title,
    creator: book.authors?.[0]?.name ?? 'Unknown',
    year: book.publish_date ? parseInt(book.publish_date) : null,
    cover_url: book.cover?.large ?? null,
    source: 'openlibrary',
  }
}
