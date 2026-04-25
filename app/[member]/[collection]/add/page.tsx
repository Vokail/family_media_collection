'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import BarcodeScanner from '@/components/BarcodeScanner'
import SearchResults from '@/components/SearchResults'
import type { SearchResult, CollectionType } from '@/lib/types'

export default function AddItemPage() {
  const params = useParams()
  const router = useRouter()
  const member = params.member as string
  const collection = params.collection as CollectionType

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${collection}`)
    setResults(res.ok ? await res.json() : [])
    setLoading(false)
  }, [collection])

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
      }),
    })
    setAdding(null)
    router.push(`/${member}/${collection}`)
  }

  const collectionLabel = collection === 'vinyl' ? 'Vinyl' : collection === 'book' ? 'Book' : 'Comic'

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="btn-ghost text-sm">← Back</button>
        <h1 className="font-serif text-xl font-bold">Add {collectionLabel}</h1>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="Search by title or artist…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runSearch(query)}
        />
        <button onClick={() => setScanning(true)} className="btn-ghost px-4 text-xl" title="Scan barcode">📷</button>
        <button onClick={() => runSearch(query)} className="btn-primary px-4" disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
      </div>

      <SearchResults results={results} onAdd={handleAdd} adding={adding} />

      {scanning && <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setScanning(false)} />}
    </main>
  )
}
