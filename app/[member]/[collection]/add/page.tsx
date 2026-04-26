'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState, useCallback, useEffect } from 'react'
import BarcodeScanner from '@/components/BarcodeScanner'
import SearchResults from '@/components/SearchResults'
import type { SearchResult, CollectionType } from '@/lib/types'

const COMIC_LANGUAGES = [
  { value: 'dutch', label: 'Nederlands' },
  { value: 'english', label: 'English' },
  { value: 'french', label: 'Français' },
  { value: 'german', label: 'Deutsch' },
  { value: 'all', label: 'All languages' },
]

const langStorageKey = (col: string) => `search_lang_${col}`

export default function AddItemPage() {
  const params = useParams()
  const router = useRouter()
  const member = params.member as string
  const collection = params.collection as CollectionType

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [comicLang, setComicLang] = useState('dutch')
  const [offset, setOffset] = useState(0)
  const [lastQuery, setLastQuery] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem(langStorageKey(collection))
    if (saved) setComicLang(saved)
  }, [collection])

  function handleLangChange(lang: string) {
    setComicLang(lang)
    localStorage.setItem(langStorageKey(collection), lang)
  }

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setOffset(0)
    setLastQuery(q)
    const lang = collection === 'book' ? comicLang : undefined
    const url = `/api/search?q=${encodeURIComponent(q)}&type=${collection}${lang ? `&lang=${lang}` : ''}`
    const res = await fetch(url)
    setResults(res.ok ? await res.json() : [])
    setLoading(false)
  }, [collection, comicLang])

  const loadMore = useCallback(async () => {
    const nextOffset = offset + 20
    setLoadingMore(true)
    const lang = collection === 'book' ? comicLang : undefined
    const url = `/api/search?q=${encodeURIComponent(lastQuery)}&type=${collection}&offset=${nextOffset}${lang ? `&lang=${lang}` : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const more: SearchResult[] = await res.json()
      setResults(prev => {
        const existingIds = new Set(prev.map(r => r.external_id))
        return [...prev, ...more.filter(r => !existingIds.has(r.external_id))]
      })
      setOffset(nextOffset)
    }
    setLoadingMore(false)
  }, [collection, comicLang, lastQuery, offset])

  const handleBarcodeDetected = useCallback(async (code: string) => {
    setScanning(false)
    setLoading(true)
    const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}&type=${collection}`)
    if (res.ok) {
      const result: SearchResult = await res.json()
      setResults([result])
      setLoading(false)
    } else {
      setQuery(code)
      setLoading(false)
      await runSearch(code)
    }
  }, [collection, runSearch])

  async function handleAdd(result: SearchResult, isWishlist: boolean) {
    setAdding(result.external_id)
    await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberSlug: member,
        collection,
        title: result.title,
        creator: result.creator,
        year: result.year,
        cover_url: result.cover_url,
        is_wishlist: isWishlist,
        external_id: result.external_id,
      }),
    })
    setAdding(null)
    window.location.href = `/${member}/${collection}`
  }

  const collectionLabel = collection === 'vinyl' ? 'Vinyl' : collection === 'book' ? 'Book' : collection === 'lego' ? 'Lego Set' : 'Comic'

  return (
    <main className="min-h-screen p-4 max-w-lg md:max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="btn-ghost text-sm">← Back</button>
        <h1 className="font-serif text-xl font-bold">Add {collectionLabel}</h1>
      </div>

      {collection === 'book' && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {COMIC_LANGUAGES.map(l => (
            <button
              key={l.value}
              onClick={() => handleLangChange(l.value)}
              className={`btn-ghost text-xs ${comicLang === l.value ? 'active' : ''}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="Search by title or artist…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runSearch(query)}
        />
        <button onClick={() => setScanning(true)} className="btn-ghost px-4 text-xl md:hidden" title="Scan barcode">📷</button>
        <button onClick={() => runSearch(query)} className="btn-primary px-4" disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
      </div>

      <SearchResults results={results} onAdd={handleAdd} adding={adding} />

      {results.length > 0 && (
        <div className="flex justify-center mt-4">
          <button onClick={loadMore} disabled={loadingMore} className="btn-ghost text-sm px-6">
            {loadingMore ? 'Loading…' : 'Load more results'}
          </button>
        </div>
      )}

      {scanning && <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setScanning(false)} />}
    </main>
  )
}
