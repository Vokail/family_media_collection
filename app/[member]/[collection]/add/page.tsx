'use client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import BarcodeScanner from '@/components/BarcodeScanner'
import PhotoCapture from '@/components/PhotoCapture'
import SearchPane, { type SearchPaneHandle } from '@/components/SearchPane'
import ManualEntryForm, { type ManualEntryFormHandle } from '@/components/ManualEntryForm'
import ScanPicker from '@/components/ScanPicker'
import { useToast } from '@/components/Toast'
import type { SearchResult, CollectionType, Item } from '@/lib/types'
import { toTitleCase } from '@/lib/utils'
import { navigateTo } from '@/lib/navigate'

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
  const searchPaneRef = useRef<SearchPaneHandle>(null)
  const manualFormRef = useRef<ManualEntryFormHandle>(null)
  const barcodeAbort = useRef<AbortController | null>(null)
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [adding, setAdding] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [showScanPicker, setShowScanPicker] = useState(false)
  const [showCoverCapture, setShowCoverCapture] = useState(false)
  const [scanCover, setScanCover] = useState<File | null>(null)
  const [identifying, setIdentifying] = useState(false)
  const [searchLang, setSearchLang] = useState('dutch')
  const [existingItems, setExistingItems] = useState<Item[]>([])

  // ── Initialisation ───────────────────────────────────────────────────────

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

  // Clear redirect timer on unmount
  useEffect(() => () => { if (navTimer.current) clearTimeout(navTimer.current) }, [])

  // #121: cancel the auto-navigate timer on any user interaction so they aren't
  // yanked back to the collection while in the middle of adding another item.
  useEffect(() => {
    const cancel = () => {
      if (navTimer.current) { clearTimeout(navTimer.current); navTimer.current = null }
    }
    document.addEventListener('pointerdown', cancel)
    document.addEventListener('keydown', cancel)
    return () => {
      document.removeEventListener('pointerdown', cancel)
      document.removeEventListener('keydown', cancel)
    }
  }, [])

  // ── Dupe detection ────────────────────────────────────────────────────────

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
      if (result.source === 'rebrickable' || result.source === 'discogs') return null
    }
    const key = `${result.title.toLowerCase().trim()}|${result.creator.toLowerCase().trim()}`
    return dupeMap.byTitle.get(key) ?? null
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  function goToCollection() {
    if (navTimer.current) clearTimeout(navTimer.current)
    navigateTo(`/${member}/${collection}`)
  }

  function scheduleNav() {
    if (navTimer.current) clearTimeout(navTimer.current)
    navTimer.current = setTimeout(goToCollection, 5000)
  }

  // ── Search-result add ─────────────────────────────────────────────────────

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
        num_parts: result.num_parts ?? null,
      }),
    })
    setAdding(null)
    if (res.ok) {
      const added = await res.json()
      setExistingItems(prev => [...prev, added])
      searchPaneRef.current?.reset()
      setScanCover(null)
      toast.show(
        isWishlist ? 'Added to wishlist' : 'Added to collection',
        'success',
        { label: 'View collection', onClick: goToCollection },
      )
      scheduleNav()
    } else {
      toast.show('Could not add item', 'error')
    }
  }

  // ── Barcode scanning ──────────────────────────────────────────────────────

  const handleBarcodeDetected = useCallback(async (code: string) => {
    barcodeAbort.current?.abort()
    const controller = new AbortController()
    barcodeAbort.current = controller

    setScanning(false)
    // Clear pane and show loading
    searchPaneRef.current?.inject(code, [], null)
    searchPaneRef.current?.setExternalLoading(true)

    try {
      const lang = (collection === 'book' || collection === 'comic') ? searchLang : undefined
      const res = await fetch(
        `/api/barcode?code=${encodeURIComponent(code)}&type=${collection}${lang ? `&lang=${lang}` : ''}`,
        { signal: controller.signal },
      )
      if (res.ok) {
        searchPaneRef.current?.inject(code, [await res.json()], null)
      } else {
        searchPaneRef.current?.setExternalLoading(false)
        searchPaneRef.current?.setHint(
          'Barcode not found — fill in the details below to save it for future updates.',
        )
        if (/^\d{10,13}$/.test(code)) {
          manualFormRef.current?.prefill({ isbn: code })
        } else {
          manualFormRef.current?.open()
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        searchPaneRef.current?.setExternalLoading(false)
        searchPaneRef.current?.setHint('Barcode lookup failed — search by title below.')
      }
    }
  }, [collection, searchLang])

  // ── Cover OCR ────────────────────────────────────────────────────────────

  const handleCoverCapture = useCallback(async (file: File) => {
    setShowCoverCapture(false)
    setScanCover(file)
    setIdentifying(true)

    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/ocr', { method: 'POST', body: form })

      if (!res.ok) {
        const ocrMessage =
          res.status === 429
            ? 'Cover scan has reached its daily limit — try again tomorrow or fill in the details below.'
            : res.status === 503
              ? 'Cover scan is not available right now — fill in the details below.'
              : 'Cover scan failed — fill in the details below.'
        toast.show(ocrMessage, 'error')
        manualFormRef.current?.prefill({ cover: file })
        return
      }

      const { series: rawSeries, title: rawTitle, creator: rawCreator } =
        await res.json() as { series: string; title: string; creator: string }
      const series = toTitleCase((rawSeries ?? '').trim())
      const title = toTitleCase(rawTitle.trim())
      const creator = toTitleCase(rawCreator.trim())

      // Pre-fill manual form with OCR results (cover + text fields)
      const fullTitle = series && title ? `${series}: ${title}` : title || series
      manualFormRef.current?.prefill({
        ...(fullTitle ? { title: fullTitle } : {}),
        ...(creator ? { creator } : {}),
      })

      if (title || series) {
        const searchQuery = [series, title].filter(Boolean).join(' ')
        await searchPaneRef.current?.runSearch(searchQuery)
      } else {
        toast.show('Could not read the cover — fill in the details below.', 'error')
        manualFormRef.current?.prefill({ cover: file })
      }
    } catch {
      toast.show('Cover scan failed — fill in the details below.', 'error')
      manualFormRef.current?.prefill({ cover: file })
    } finally {
      setIdentifying(false)
    }
  }, [toast])

  function handleLangChange(lang: string) {
    setSearchLang(lang)
    localStorage.setItem(langStorageKey(collection), lang)
  }

  const collectionLabel =
    collection === 'vinyl' ? 'Vinyl'
    : collection === 'book' ? 'Book'
    : collection === 'lego' ? 'Lego Set'
    : 'Comic'

  return (
    <main className="min-h-screen p-4 max-w-lg md:max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${member}/${collection}`} className="btn-ghost text-sm">← Back</Link>
        <h1 className="font-serif text-xl font-bold">Add {collectionLabel}</h1>
      </div>

      {/* Language selector (books + comics only) */}
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

      <SearchPane
        ref={searchPaneRef}
        collection={collection}
        searchLang={searchLang}
        getDupeStatus={getDupeStatus}
        onAdd={handleAdd}
        adding={adding}
        identifying={identifying}
        onScanRequest={() => setShowScanPicker(true)}
        onIsbnNotFound={isbn => manualFormRef.current?.prefill({ isbn })}
      />

      <ManualEntryForm
        ref={manualFormRef}
        collection={collection}
        member={member}
        scanCover={scanCover}
        goToCollection={goToCollection}
        onAdded={item => setExistingItems(prev => [...prev, item])}
        scheduleNav={scheduleNav}
      />

      {/* Overlays */}
      {scanning && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setScanning(false)}
        />
      )}

      {showCoverCapture && (
        <PhotoCapture
          onCapture={handleCoverCapture}
          onClose={() => setShowCoverCapture(false)}
        />
      )}

      <ScanPicker
        show={showScanPicker}
        collection={collection}
        identifying={identifying}
        onClose={() => setShowScanPicker(false)}
        onBarcodeRequest={() => { setShowScanPicker(false); setScanning(true) }}
        onCoverOCRRequest={() => { setShowScanPicker(false); setShowCoverCapture(true) }}
      />
    </main>
  )
}
