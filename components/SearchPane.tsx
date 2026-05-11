/**
 * SearchPane — search bar, results, load-more, and back-to-top.
 *
 * Owns all search-related state (query, results, pagination, loading).
 * Exposed imperatively via SearchPaneHandle so the parent can inject results
 * from barcode / OCR flows without pushing all state up.
 */
'use client'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import SearchResults from '@/components/SearchResults'
import { searchOpenLibrary } from '@/lib/apis/openlibrary'
import type { CollectionType, SearchResult } from '@/lib/types'

export interface SearchPaneHandle {
  /**
   * Replace the current query + results (and optionally a hint text).
   * Pass an empty results array + no hint to put the pane in a clean loading
   * state; call setExternalLoading(true) immediately after.
   */
  inject(query: string, results: SearchResult[], hint?: string | null): void
  /** Update just the hint text (e.g. "Barcode not found — add manually"). */
  setHint(hint: string | null): void
  /** Force the loading spinner on or off from outside the component. */
  setExternalLoading(loading: boolean): void
  /** Run a search (equivalent to typing q into the box and pressing Search). */
  runSearch(query: string): Promise<void>
  /** Clear everything back to the initial empty state. */
  reset(): void
}

interface SearchPaneProps {
  collection: CollectionType
  /** Currently selected search language (controlled by parent). */
  searchLang: string
  getDupeStatus: (result: SearchResult) => 'owned' | 'wishlist' | null
  onAdd: (result: SearchResult, isWishlist: boolean) => Promise<void>
  /** External adding-in-progress id (owned by parent's handleAdd). */
  adding: string | null
  /** True while OCR identification is running — disables Search button. */
  identifying: boolean
  /** Called when the camera/scan icon is tapped. */
  onScanRequest: () => void
  /**
   * Called when a typed ISBN query returns no results.
   * Parent opens ManualEntryForm with the ISBN pre-filled.
   */
  onIsbnNotFound: (isbn: string) => void
}

const SearchPane = forwardRef<SearchPaneHandle, SearchPaneProps>(
  function SearchPane(
    {
      collection,
      searchLang,
      getDupeStatus,
      onAdd,
      adding,
      identifying,
      onScanRequest,
      onIsbnNotFound,
    },
    ref,
  ) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [hasSearched, setHasSearched] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [barcodeHint, setBarcodeHint] = useState<string | null>(null)
    const [offset, setOffset] = useState(0)
    const [lastQuery, setLastQuery] = useState('')
    const [showBackToTop, setShowBackToTop] = useState(false)

    // Ref keeps loadMore's closure in sync with results without adding results
    // to loadMore's dep array (which would recreate it on every result change).
    const resultsRef = useRef<SearchResult[]>([])
    const searchInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { resultsRef.current = results }, [results])

    // Back-to-top button visibility
    useEffect(() => {
      const onScroll = () => setShowBackToTop(window.scrollY > 300)
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }, [])

    // ── Imperative handle ──────────────────────────────────────────────────

    const runSearch = useCallback(async (q: string) => {
      if (!q.trim()) return

      // ISBN shortcut: route to barcode lookup instead of full-text search
      const isbnClean = q.replace(/[-\s]/g, '')
      if (
        (collection === 'book' || collection === 'comic') &&
        /^\d{10}$|^\d{13}$/.test(isbnClean)
      ) {
        setLoading(true)
        setQuery(isbnClean)
        setResults([])
        setOffset(0)
        setHasMore(false)
        const res = await fetch(
          `/api/barcode?code=${encodeURIComponent(isbnClean)}&type=${collection}&lang=${searchLang}`,
        )
        if (res.ok) {
          setResults([await res.json()])
          setHasSearched(true)
        } else {
          setHasSearched(true)
          setBarcodeHint(
            'ISBN not found in any database — fill in the details below to add it manually.',
          )
          onIsbnNotFound(isbnClean)
        }
        setLoading(false)
        return
      }

      setLoading(true)
      setQuery(q)
      setOffset(0)
      setLastQuery(q)

      let data: SearchResult[]
      if (collection === 'book') {
        data = await searchOpenLibrary(q, 0, searchLang)
        setHasMore(data.length === 20)
      } else {
        const lang = collection === 'comic' ? searchLang : undefined
        const url = `/api/search?q=${encodeURIComponent(q)}&type=${collection}${lang ? `&lang=${lang}` : ''}`
        const res = await fetch(url)
        if (res.ok) {
          const json = await res.json()
          if (Array.isArray(json)) {
            data = json
            setHasMore(data.length === 20)
          } else {
            data = json.results ?? []
            setHasMore(json.hasMore ?? false)
          }
        } else {
          data = []
          setHasMore(false)
        }
      }

      setResults(data)
      setHasSearched(true)
      setLoading(false)
    }, [collection, searchLang, onIsbnNotFound])

    useImperativeHandle(ref, () => ({
      inject(q, newResults, hint = null) {
        setQuery(q)
        setResults(newResults)
        setBarcodeHint(hint ?? null)
        setHasSearched(newResults.length > 0 || hint != null)
        setHasMore(false)
        setOffset(0)
        setLoading(false)
      },
      setHint(hint) { setBarcodeHint(hint) },
      setExternalLoading(v) { setLoading(v) },
      runSearch,
      reset() {
        setQuery('')
        setResults([])
        setHasSearched(false)
        setHasMore(false)
        setLoading(false)
        setLoadingMore(false)
        setBarcodeHint(null)
        setOffset(0)
        setLastQuery('')
      },
    }), [runSearch])

    // ── Load more ─────────────────────────────────────────────────────────

    const loadMore = useCallback(async () => {
      setLoadingMore(true)
      let currentOffset = offset
      const MAX_ATTEMPTS = 10
      const EMPTY_THRESHOLD = 3
      const allFresh: SearchResult[] = []
      let lastApiHasMore = false
      let consecutiveEmpty = 0

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const nextOffset = currentOffset + 20
        let more: SearchResult[]
        let apiHasMore: boolean

        if (collection === 'book') {
          more = await searchOpenLibrary(lastQuery, nextOffset, searchLang)
          apiHasMore = more.length === 20
        } else {
          const lang = collection === 'comic' ? searchLang : undefined
          const url =
            `/api/search?q=${encodeURIComponent(lastQuery)}&type=${collection}&offset=${nextOffset}` +
            (lang ? `&lang=${lang}` : '')
          const res = await fetch(url)
          if (res.ok) {
            const json = await res.json()
            if (Array.isArray(json)) {
              more = json
              apiHasMore = more.length === 20
            } else {
              more = json.results ?? []
              apiHasMore = json.hasMore ?? false
            }
          } else {
            more = []
            apiHasMore = false
          }
        }

        const existingIds = new Set([
          ...resultsRef.current.map(r => r.external_id),
          ...allFresh.map(r => r.external_id),
        ])
        const fresh = more.filter(r => !existingIds.has(r.external_id))
        allFresh.push(...fresh)
        lastApiHasMore = apiHasMore
        currentOffset = nextOffset

        if (!apiHasMore) break

        if (fresh.length > 0) {
          consecutiveEmpty = 0
        } else {
          consecutiveEmpty++
          if (consecutiveEmpty >= EMPTY_THRESHOLD) break
        }
      }

      const stillHasMore = lastApiHasMore && consecutiveEmpty < EMPTY_THRESHOLD

      if (allFresh.length > 0) {
        setOffset(currentOffset)
        setResults(prev => {
          const ids = new Set(prev.map(r => r.external_id))
          return [...prev, ...allFresh.filter(r => !ids.has(r.external_id))]
        })
        setHasMore(stillHasMore)
      } else {
        setHasMore(false)
      }

      setLoadingMore(false)
    }, [collection, searchLang, lastQuery, offset])

    // ── Render ────────────────────────────────────────────────────────────

    return (
      <>
        {barcodeHint && (
          <p className="text-sm mb-2 text-center" style={{ color: 'var(--text-muted)' }}>
            {barcodeHint}
          </p>
        )}

        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              className="input w-full pr-8"
              placeholder="Search by title or artist…"
              value={query}
              onChange={e => { setQuery(e.target.value); setBarcodeHint(null) }}
              onKeyDown={e => e.key === 'Enter' && runSearch(query)}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('')
                  setResults([])
                  setOffset(0)
                  setBarcodeHint(null)
                  searchInputRef.current?.focus()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm leading-none px-1"
                style={{ color: 'var(--text-muted)' }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={onScanRequest}
            className="btn-ghost px-4 text-xl md:hidden"
            title="Scan"
          >
            {identifying ? '⏳' : '📷'}
          </button>

          <button
            onClick={() => runSearch(query)}
            className="btn-primary px-4 flex items-center gap-2"
            disabled={loading || identifying}
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="flex justify-center py-10">
            <span
              className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {/* Results */}
        {!loading && (
          <SearchResults
            results={results}
            hasSearched={hasSearched}
            onAdd={onAdd}
            adding={adding}
            getDupeStatus={getDupeStatus}
          />
        )}

        {/* Load more */}
        {!loading && hasMore && results.length > 0 && (
          <div className="flex justify-center mt-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn-ghost text-sm px-6 flex items-center gap-2"
            >
              {loadingMore ? (
                <>
                  <span
                    className="inline-block w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
                    style={{
                      borderColor: 'var(--text-muted)',
                      borderTopColor: 'transparent',
                    }}
                  />
                  Loading…
                </>
              ) : (
                'Load more results'
              )}
            </button>
          </div>
        )}

        {/* Back to top */}
        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-30 w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold shadow-lg"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            aria-label="Back to top"
          >
            ↑
          </button>
        )}
      </>
    )
  },
)

export default SearchPane
