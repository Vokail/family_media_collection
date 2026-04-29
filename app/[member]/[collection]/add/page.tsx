'use client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import BarcodeScanner from '@/components/BarcodeScanner'
import PhotoCapture from '@/components/PhotoCapture'
import SearchResults from '@/components/SearchResults'
import { useToast } from '@/components/Toast'
import type { SearchResult, CollectionType, Item } from '@/lib/types'

const SEARCH_LANGUAGES = [
  { value: 'dutch', label: 'Nederlands' },
  { value: 'english', label: 'English' },
  { value: 'french', label: 'Français' },
  { value: 'german', label: 'Deutsch' },
  { value: 'all', label: 'All languages' },
]

const langStorageKey = (col: string) => `search_lang_${col}`

export default function AddItemPage() {
  const params = useParams()
  const member = params.member as string
  const collection = params.collection as CollectionType

  const toast = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [barcodeHint, setBarcodeHint] = useState<string | null>(null)
  const [searchLang, setSearchLang] = useState('dutch')
  const [offset, setOffset] = useState(0)
  const [lastQuery, setLastQuery] = useState('')
  const barcodeAbort = useRef<AbortController | null>(null)
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualCreator, setManualCreator] = useState('')
  const [manualYear, setManualYear] = useState('')
  const [manualIsbn, setManualIsbn] = useState('')
  const [manualCover, setManualCover] = useState<File | null>(null)
  const [addingManual, setAddingManual] = useState(false)
  const [showManualCamera, setShowManualCamera] = useState(false)
  const manualFileRef = useRef<HTMLInputElement>(null)
  const [showScanPicker, setShowScanPicker] = useState(false)
  const [showCoverCapture, setShowCoverCapture] = useState(false)
  const [scanCover, setScanCover] = useState<File | null>(null)
  const [identifying, setIdentifying] = useState(false)
  const [existingItems, setExistingItems] = useState<Item[]>([])

  useEffect(() => {
    const saved = localStorage.getItem(langStorageKey(collection))
    if (saved) setSearchLang(saved)
  }, [collection])

  useEffect(() => {
    fetch(`/api/items?member=${member}&collection=${collection}`)
      .then(r => r.ok ? r.json() : [])
      .then(setExistingItems)
      .catch(() => {})
  }, [member, collection])

  const dupeMap = useMemo(() => {
    const byId = new Map<string, 'owned' | 'wishlist'>()
    const byTitle = new Map<string, 'owned' | 'wishlist'>()
    for (const item of existingItems) {
      const status = item.is_wishlist ? 'wishlist' : 'owned'
      if (item.external_id) byId.set(item.external_id, status)
      byTitle.set(`${item.title.toLowerCase().trim()}|${item.creator.toLowerCase().trim()}`, status)
    }
    return { byId, byTitle }
  }, [existingItems])

  function getDupeStatus(result: SearchResult): 'owned' | 'wishlist' | null {
    if (result.external_id) {
      const s = dupeMap.byId.get(result.external_id)
      if (s) return s
    }
    const key = `${result.title.toLowerCase().trim()}|${result.creator.toLowerCase().trim()}`
    return dupeMap.byTitle.get(key) ?? null
  }

  function handleLangChange(lang: string) {
    setSearchLang(lang)
    localStorage.setItem(langStorageKey(collection), lang)
  }

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setOffset(0)
    setLastQuery(q)
    const lang = (collection === 'book' || collection === 'comic') ? searchLang : undefined
    const url = `/api/search?q=${encodeURIComponent(q)}&type=${collection}${lang ? `&lang=${lang}` : ''}`
    const res = await fetch(url)
    setResults(res.ok ? await res.json() : [])
    setLoading(false)
  }, [collection, searchLang])

  const loadMore = useCallback(async () => {
    const nextOffset = offset + 20
    setLoadingMore(true)
    const lang = (collection === 'book' || collection === 'comic') ? searchLang : undefined
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
  }, [collection, searchLang, lastQuery, offset])

  const handleBarcodeDetected = useCallback(async (code: string) => {
    barcodeAbort.current?.abort()
    const controller = new AbortController()
    barcodeAbort.current = controller

    setScanning(false)
    setLoading(true)
    setResults([])
    setQuery('')
    setBarcodeHint(null)

    try {
      const lang = (collection === 'book' || collection === 'comic') ? searchLang : undefined
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}&type=${collection}${lang ? `&lang=${lang}` : ''}`, {
        signal: controller.signal,
      })
      if (res.ok) {
        setResults([await res.json()])
      } else {
        setBarcodeHint('Barcode not found — fill in the details below to save it for future updates.')
        if (/^\d{10,13}$/.test(code)) setManualIsbn(code)
        setShowManual(true)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setBarcodeHint('Barcode lookup failed — search by title below.')
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [collection, searchLang])

  const handleCoverCapture = useCallback(async (file: File) => {
    setShowCoverCapture(false)
    setScanCover(file)
    setIdentifying(true)

    try {
      // Lazy-load Tesseract only when needed — runs in the browser, no serverless timeout
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng+nld')
      const { data } = await worker.recognize(file)
      await worker.terminate()

      // Filter noise: keep lines that look like real text (>2 chars, not purely numeric/punctuation)
      const lines = data.text
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 2 && /[a-zA-Z]{2,}/.test(l))

      const toTitleCase = (s: string) =>
        s.toLowerCase().replace(/(^|\s|-)\S/g, c => c.toUpperCase())

      // Title = first substantial line (covers print titles at the top)
      // Creator = last substantial line (authors printed at the bottom)
      const title = toTitleCase(lines[0] ?? '')
      const creator = toTitleCase(lines.length > 1 ? lines[lines.length - 1] : '')
      const confident = data.confidence >= 40 && title.length > 2

      // Always pre-fill whatever was extracted, regardless of confidence
      if (title) setManualTitle(title)
      if (creator) setManualCreator(creator)

      if (confident && title) {
        // Combine title + creator in the search query so results are good even if
        // the heuristic swapped them. Show only the title in the search box.
        const searchQuery = [title, creator].filter(Boolean).join(' ')
        setQuery(title)
        await runSearch(searchQuery)
      } else {
        // Low confidence — go straight to manual form (fields already pre-filled above)
        setShowManual(true)
        setManualCover(file)
      }
    } catch {
      setShowManual(true)
      setManualCover(file)
    } finally {
      setIdentifying(false)
    }
  }, [runSearch, searchLang])

  function goToCollection() {
    if (navTimer.current) clearTimeout(navTimer.current)
    window.location.href = `/${member}/${collection}`
  }

  async function handleAdd(result: SearchResult, isWishlist: boolean) {
    setAdding(result.external_id)
    const res = await fetch('/api/items', {
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
        isbn: result.isbn ?? null,
        lang: collection === 'book' ? searchLang : undefined,
        genres: result.genres ?? null,
        styles: result.styles ?? null,
      }),
    })
    setAdding(null)
    if (res.ok) {
      // Update dupe map so the card shows "In collection" immediately
      const added = await res.json()
      setExistingItems(prev => [...prev, added])
      // Clear search so the page is ready for the next item
      setResults([])
      setQuery('')
      setOffset(0)
      setBarcodeHint(null)
      setScanCover(null)
      toast.show(
        isWishlist ? 'Added to wishlist' : 'Added to collection',
        'success',
        { label: 'View collection', onClick: goToCollection },
      )
      // Auto-navigate when the toast disappears; cancel any previous pending timer
      if (navTimer.current) clearTimeout(navTimer.current)
      navTimer.current = setTimeout(goToCollection, 5000)
    } else {
      toast.show('Could not add item', 'error')
    }
  }

  async function handleManualAdd(isWishlist: boolean) {
    if (!manualTitle.trim()) return
    setAddingManual(true)
    const body = new FormData()
    body.append('memberSlug', member)
    body.append('collection', collection)
    body.append('title', manualTitle.trim())
    body.append('creator', manualCreator.trim())
    body.append('year', manualYear)
    body.append('is_wishlist', String(isWishlist))
    if (manualIsbn) body.append('isbn', manualIsbn)
    if (manualCover) body.append('cover', manualCover)
    const res = await fetch('/api/items/manual', { method: 'POST', body })
    setAddingManual(false)
    if (res.ok) {
      const added = await res.json()
      setExistingItems(prev => [...prev, added])
      // Reset manual form
      setManualTitle('')
      setManualCreator('')
      setManualYear('')
      setManualIsbn('')
      setManualCover(null)
      toast.show(
        isWishlist ? 'Added to wishlist' : 'Added to collection',
        'success',
        { label: 'View collection', onClick: goToCollection },
      )
      if (navTimer.current) clearTimeout(navTimer.current)
      navTimer.current = setTimeout(goToCollection, 5000)
    } else {
      toast.show('Could not add item', 'error')
    }
  }

  const collectionLabel = collection === 'vinyl' ? 'Vinyl' : collection === 'book' ? 'Book' : collection === 'lego' ? 'Lego Set' : 'Comic'

  return (
    <main className="min-h-screen p-4 max-w-lg md:max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${member}/${collection}`} className="btn-ghost text-sm">← Back</Link>
        <h1 className="font-serif text-xl font-bold">Add {collectionLabel}</h1>
      </div>

      {(collection === 'book' || collection === 'comic') && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {SEARCH_LANGUAGES.map(l => (
            <button
              key={l.value}
              onClick={() => handleLangChange(l.value)}
              className={`btn-ghost text-xs ${searchLang === l.value ? 'active' : ''}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {barcodeHint && (
        <p className="text-sm mb-2 text-center" style={{ color: 'var(--text-muted)' }}>{barcodeHint}</p>
      )}
      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="Search by title or artist…"
          value={query}
          onChange={e => { setQuery(e.target.value); setBarcodeHint(null) }}
          onKeyDown={e => e.key === 'Enter' && runSearch(query)}
        />
        <button onClick={() => setShowScanPicker(true)} className="btn-ghost px-4 text-xl md:hidden" title="Scan">
          {identifying ? '⏳' : '📷'}
        </button>
        <button onClick={() => runSearch(query)} className="btn-primary px-4" disabled={loading || identifying}>
          {loading ? '…' : 'Search'}
        </button>
      </div>

      <SearchResults results={results} onAdd={handleAdd} adding={adding} getDupeStatus={getDupeStatus} />

      {results.length > 0 && (
        <div className="flex justify-center mt-4">
          <button onClick={loadMore} disabled={loadingMore} className="btn-ghost text-sm px-6">
            {loadingMore ? 'Loading…' : 'Load more results'}
          </button>
        </div>
      )}

      <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => {
            const next = !showManual
            setShowManual(next)
            if (next && scanCover) setManualCover(scanCover)
          }}
          className="btn-ghost text-sm w-full text-center"
        >
          {showManual ? 'Hide manual entry' : 'Not found? Add manually'}
        </button>

        {showManual && (
          <div className="card p-4 mt-3 flex flex-col gap-3">
            <div>
              <label className="label mb-1 block">Title *</label>
              <input className="input" value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Title" />
            </div>
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => { const t = manualTitle; setManualTitle(manualCreator); setManualCreator(t) }}
                className="btn-ghost text-xs px-3 py-1"
                title="Swap title and author"
              >
                ⇅ Swap title &amp; author
              </button>
            </div>
            <div>
              <label className="label mb-1 block">{collection === 'vinyl' ? 'Artist' : collection === 'lego' ? 'Theme' : 'Author / Publisher'}</label>
              <input className="input" value={manualCreator} onChange={e => setManualCreator(e.target.value)} placeholder="Creator" />
            </div>
            <div>
              <label className="label mb-1 block">Year</label>
              <input className="input" type="number" value={manualYear} onChange={e => setManualYear(e.target.value)} placeholder="e.g. 2023" />
            </div>
            {(collection === 'book' || collection === 'comic' || manualIsbn) && (
              <div>
                <label className="label mb-1 block">ISBN (for future auto-fill)</label>
                <input className="input font-mono text-sm" value={manualIsbn} onChange={e => setManualIsbn(e.target.value)} placeholder="e.g. 9781234567890" />
              </div>
            )}
            <div>
              <label className="label mb-1 block">Cover image (optional)</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowManualCamera(true)} className="btn-ghost text-xs md:hidden">📷</button>
                <button onClick={() => manualFileRef.current?.click()} className="btn-ghost text-xs">
                  {manualCover ? manualCover.name : 'Add cover…'}
                </button>
                <input
                  ref={manualFileRef}
                  type="file"
                  accept="image/*"
                  onChange={e => setManualCover(e.target.files?.[0] ?? null)}
                  style={{ position: 'fixed', top: '-100vh', left: 0, opacity: 0, pointerEvents: 'none' }}
                />
                {manualCover && <button onClick={() => setManualCover(null)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => handleManualAdd(false)} disabled={addingManual || !manualTitle.trim()} className="btn-primary flex-1">
                {addingManual ? '…' : 'Add to collection'}
              </button>
              <button onClick={() => handleManualAdd(true)} disabled={addingManual || !manualTitle.trim()} className="btn-ghost flex-1">
                Add to wishlist
              </button>
            </div>
          </div>
        )}
      </div>

      {scanning && <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setScanning(false)} />}
      {showManualCamera && (
        <PhotoCapture
          onCapture={file => { setManualCover(file); setShowManualCamera(false) }}
          onClose={() => setShowManualCamera(false)}
        />
      )}
      {showCoverCapture && (
        <PhotoCapture
          onCapture={handleCoverCapture}
          onClose={() => setShowCoverCapture(false)}
        />
      )}

      {/* Scan picker bottom sheet */}
      {showScanPicker && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={() => setShowScanPicker(false)}>
          <div className="w-full rounded-t-2xl p-6 flex flex-col gap-3" style={{ backgroundColor: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
            <p className="font-serif text-base font-semibold text-center mb-1">What do you want to scan?</p>
            <button
              className="btn-ghost text-sm py-3 w-full text-center"
              onClick={() => { setShowScanPicker(false); setScanning(true) }}
            >
              📦 Scan barcode
            </button>
            <button
              className="btn-ghost text-sm py-3 w-full text-center"
              onClick={() => { setShowScanPicker(false); setShowCoverCapture(true) }}
            >
              🖼 Scan cover (OCR)
            </button>
            <button className="btn-ghost text-sm py-2 w-full text-center" style={{ color: 'var(--text-muted)' }} onClick={() => setShowScanPicker(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
