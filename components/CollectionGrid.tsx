'use client'
import Link from 'next/link'
import { useState, useRef, useCallback, useEffect } from 'react'
import ItemCard from './ItemCard'
import type { Item, CollectionType, Member } from '@/lib/types'

const PULL_THRESHOLD = 72
const PAGE_SIZE = 60

type SortMode = 'added' | 'creator' | 'title' | 'year' | 'rating' | 'condition' | 'status'

const TABS: { label: string; value: CollectionType }[] = [
  { label: 'Vinyl', value: 'vinyl' },
  { label: 'Books', value: 'book' },
  { label: 'Comics', value: 'comic' },
  { label: 'Lego', value: 'lego' },
]

function sortCreatorLabel(collection: CollectionType): string {
  if (collection === 'lego') return 'Theme'
  if (collection === 'book') return 'Author'
  return 'Artist'
}

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
const LIST = 'flex flex-col'
type ViewMode = 'grid' | 'list'

// Use Discogs sort_name when available (e.g. "Sinatra, Frank"), else strip leading articles.
function indexKey(creator: string, sortName?: string | null): string {
  const base = sortName ?? creator.replace(/^(the|a|an)\s+/i, '').trim()
  const ch = base[0]?.toUpperCase() ?? '#'
  return /[A-Z]/.test(ch) ? ch : '#'
}

function sortKey(creator: string, sortName?: string | null): string {
  return (sortName ?? creator.replace(/^(the|a|an)\s+/i, '').trim()).toLowerCase()
}

const CONDITION_ORDER = ['mint', 'near_mint', 'good', 'poor'] as const

function sortItems(items: Item[], mode: SortMode): Item[] {
  const copy = [...items]
  if (mode === 'creator') return copy.sort((a, b) => sortKey(a.creator, a.sort_name).localeCompare(sortKey(b.creator, b.sort_name)))
  if (mode === 'title') return copy.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
  if (mode === 'year') return copy.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))
  if (mode === 'rating') return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  if (mode === 'status') return copy.sort((a, b) => {
    const ac = a.status === 'consumed' ? 1 : 0
    const bc = b.status === 'consumed' ? 1 : 0
    if (ac !== bc) return ac - bc // unread first
    return sortKey(a.creator, a.sort_name).localeCompare(sortKey(b.creator, b.sort_name))
  })
  if (mode === 'condition') return copy.sort((a, b) => {
    const ai = a.condition ? CONDITION_ORDER.indexOf(a.condition as typeof CONDITION_ORDER[number]) : CONDITION_ORDER.length
    const bi = b.condition ? CONDITION_ORDER.indexOf(b.condition as typeof CONDITION_ORDER[number]) : CONDITION_ORDER.length
    if (ai !== bi) return ai - bi
    return sortKey(a.creator, a.sort_name).localeCompare(sortKey(b.creator, b.sort_name))
  })
  return copy // 'added' — already newest-first from DB
}

interface YearGroup { label: string; shortKey: string; items: Item[] }
interface RatingGroup { label: string; key: string; items: Item[] }

function buildRatingGroups(items: Item[]): RatingGroup[] {
  const groups: RatingGroup[] = []
  for (let r = 5; r >= 1; r--) {
    const g = items.filter(i => i.rating === r)
    if (g.length > 0) groups.push({ label: '★'.repeat(r), key: String(r), items: g })
  }
  const unrated = items.filter(i => !i.rating)
  if (unrated.length > 0) groups.push({ label: 'Unrated', key: '0', items: unrated })
  return groups
}

function buildYearGroups(items: Item[]): YearGroup[] {
  const withYear = items.filter(i => i.year != null)
  const noYear = items.filter(i => i.year == null)

  // Bucket by decade
  const decadeMap = new Map<number, Item[]>()
  for (const item of withYear) {
    const decade = Math.floor(item.year! / 10) * 10
    if (!decadeMap.has(decade)) decadeMap.set(decade, [])
    decadeMap.get(decade)!.push(item)
  }

  const groups: YearGroup[] = []
  Array.from(decadeMap.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([decade, decadeItems]) => {
      if (decadeItems.length > 12) {
        // Split into two halves
        const first = decadeItems.filter(i => i.year! < decade + 5)
        const second = decadeItems.filter(i => i.year! >= decade + 5)
        if (first.length > 0) groups.push({ label: `${decade}–${decade + 4}`, shortKey: `'${String(decade).slice(-2)}a`, items: first })
        if (second.length > 0) groups.push({ label: `${decade + 5}–${decade + 9}`, shortKey: `'${String(decade).slice(-2)}b`, items: second })
      } else {
        groups.push({ label: `${decade}–${decade + 9}`, shortKey: `'${String(decade).slice(-2)}s`, items: decadeItems })
      }
    })

  if (noYear.length > 0) groups.push({ label: 'Unknown', shortKey: '?', items: noYear })
  return groups
}

interface ConditionGroup { label: string; abbr: string; color: string; items: Item[] }

const CONDITION_GRADES: ConditionGroup[] = [
  { label: 'Mint',      abbr: 'M',  color: '#16a34a', items: [] },
  { label: 'Near Mint', abbr: 'NM', color: '#0891b2', items: [] },
  { label: 'Good',      abbr: 'G',  color: '#d97706', items: [] },
  { label: 'Poor',      abbr: 'P',  color: '#dc2626', items: [] },
]

function buildConditionGroups(items: Item[]): ConditionGroup[] {
  const groups: ConditionGroup[] = CONDITION_GRADES
    .map(g => ({ ...g, items: items.filter(i => i.condition === g.label.toLowerCase().replace(' ', '_')) }))
    .filter(g => g.items.length > 0)
  const ungraded = items.filter(i => !i.condition)
  if (ungraded.length > 0) groups.push({ label: 'Ungraded', abbr: '–', color: 'var(--text-muted)', items: ungraded })
  return groups
}

interface Props {
  member: Member
  collection: CollectionType
  initialItems: Item[]
  isEditor: boolean
  supabaseUrl: string
  enabledCollections?: CollectionType[]
}

export default function CollectionGrid({ member, collection, initialItems, isEditor, supabaseUrl, enabledCollections }: Props) {
  const visibleTabs = enabledCollections
    ? TABS.filter(t => enabledCollections.includes(t.value))
    : TABS
  const sortStorageKey = `sort_${member.slug}_${collection}`
  const tabStorageKey = `tab_${member.slug}_${collection}`
  const viewStorageKey = `view_${member.slug}_${collection}`

  const [isWishlist, setIsWishlist] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(tabStorageKey) === 'wishlist' : false
  )
  const [items, setItems] = useState(initialItems)
  const [sort, setSort] = useState<SortMode>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(sortStorageKey) as SortMode | null) ?? 'creator' : 'creator'
  )
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem(viewStorageKey) as ViewMode | null) ?? 'grid' : 'grid'
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unconsumed' | 'consumed'>('all')
  const [legoFilter, setLegoFilter] = useState<'all' | 'built' | 'in_box' | 'disassembled'>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const pulling = useRef(false)

  const doRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/items?member=${member.slug}&collection=${collection}`)
      if (res.ok) setItems(await res.json())
    } finally {
      setRefreshing(false)
    }
  }, [member.slug, collection])

  // Reset visible count whenever the active filter/sort changes
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [isWishlist, sort, search, statusFilter, legoFilter, collection])

  function onTouchStart(e: React.TouchEvent) {
    // iOS can report scrollY as slightly negative during rubber-band, so use <= 0
    if ((window.scrollY ?? document.documentElement.scrollTop ?? 0) <= 0) {
      touchStartY.current = e.touches[0].clientY
      pulling.current = true
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!pulling.current) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) {
      // Don't re-check scrollY here — iOS rubber-band makes it non-zero mid-pull
      setPullY(Math.min(dy * 0.5, PULL_THRESHOLD + 20))
    }
  }

  function onTouchEnd() {
    if (pulling.current && pullY >= PULL_THRESHOLD && !refreshing) {
      doRefresh()
    }
    pulling.current = false
    setPullY(0)
  }

  function handleUpdate(updated: Item) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }
  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const ownedCount = items.filter(i => !i.is_wishlist).length
  const wishlistCount = items.filter(i => i.is_wishlist).length
  const q = search.trim().toLowerCase()
  const showStatusFilter = !isWishlist && collection !== 'lego'
  const showLegoFilter = !isWishlist && collection === 'lego'
  const filtered = items.filter(i =>
    i.is_wishlist === isWishlist &&
    (!q || i.title.toLowerCase().includes(q) || i.creator.toLowerCase().includes(q)) &&
    (!showStatusFilter || statusFilter === 'all' ||
      (statusFilter === 'consumed' ? i.status === 'consumed' : i.status !== 'consumed')) &&
    (!showLegoFilter || legoFilter === 'all' || i.lego_status === legoFilter)
  )
  const sorted = sortItems(filtered, sort)
  const displayed = sorted.slice(0, visibleCount)
  const hasMore = sorted.length > visibleCount

  // Infinite scroll — load next page when sentinel enters the viewport.
  // Re-bind whenever sorted.length changes so a filter/sort reset reconnects
  // the observer to the newly rendered sentinel.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + PAGE_SIZE) },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [sorted.length])

  const byCreator = sort === 'creator'
  const byTitle = sort === 'title'
  const byYear = sort === 'year'
  const byRating = sort === 'rating'
  const byCondition = sort === 'condition'
  const byStatus = sort === 'status'
  const byLego = byCreator && collection === 'lego'

  // Strip "LEGO " prefix from theme names for display/grouping
  function stripLego(name: string) { return name.replace(/^LEGO\s+/i, '').trim() }

  // First letter of title (stripping leading articles) for index grouping
  function titleIndexKey(title: string): string {
    const base = title.replace(/^(the|a|an)\s+/i, '').trim()
    const ch = base[0]?.toUpperCase() ?? '#'
    return /[A-Z]/.test(ch) ? ch : '#'
  }

  // Build groups when sorted by creator
  const creatorGroups: { letter: string; items: Item[] }[] = []
  if (byCreator) {
    const map = new Map<string, Item[]>()
    for (const item of displayed) {
      // Lego: group by theme name (without LEGO prefix); others: by first letter
      const k = byLego ? stripLego(item.creator) : indexKey(item.creator, item.sort_name)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(item)
    }
    Array.from(map.entries()).forEach(([letter, groupItems]) => {
      creatorGroups.push({ letter, items: groupItems })
    })
  }

  // Build groups when sorted by title
  const titleGroups: { letter: string; items: Item[] }[] = []
  if (byTitle) {
    const map = new Map<string, Item[]>()
    for (const item of displayed) {
      const k = titleIndexKey(item.title)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(item)
    }
    Array.from(map.entries()).forEach(([letter, groupItems]) => {
      titleGroups.push({ letter, items: groupItems })
    })
  }

  const yearGroups: YearGroup[] = byYear ? buildYearGroups(displayed) : []
  const ratingGroups: RatingGroup[] = byRating ? buildRatingGroups(displayed) : []
  const conditionGroups: ConditionGroup[] = byCondition ? buildConditionGroups(displayed) : []
  const statusGroups: { label: string; items: Item[] }[] = byStatus ? [
    { label: 'Unread', items: displayed.filter(i => i.status !== 'consumed') },
    { label: 'Read',   items: displayed.filter(i => i.status === 'consumed') },
  ].filter(g => g.items.length > 0) : []

  // Each sidebar entry carries a display label and the ref key used to look up the section.
  // For Lego the ref key is the full theme name; display is first 4 chars.
  const sidebarItems: { display: string; key: string }[] = byCreator
    ? byLego
      ? creatorGroups.map(g => ({ display: g.letter.slice(0, 4), key: g.letter }))
      : creatorGroups.map(g => ({ display: g.letter, key: g.letter }))
    : byTitle
    ? titleGroups.map(g => ({ display: g.letter, key: g.letter }))
    : byYear
    ? yearGroups.map(g => ({ display: g.shortKey, key: g.shortKey }))
    : []

  const hasSidebar = sidebarItems.length > 0

  function scrollTo(key: string) {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pullProgress = Math.min(pullY / PULL_THRESHOLD, 1)
  const pullTriggered = pullY >= PULL_THRESHOLD

  return (
    <div
      className="flex flex-col gap-4"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullY > 0 || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: refreshing ? 48 : pullY, opacity: refreshing ? 1 : pullProgress }}
        >
          <div
            className="w-7 h-7 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: 'var(--accent)',
              transform: refreshing ? 'none' : `rotate(${pullProgress * 180}deg)`,
              animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
            }}
          >
            {refreshing ? (
              <div className="w-3 h-3 rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: pullTriggered ? 'var(--accent)' : 'var(--text-muted)' }}>
                <path d="M6 1v8M3 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      )}
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {visibleTabs.map(tab => {
          const isActive = collection === tab.value
          return (
            <Link
              key={tab.value}
              href={`/${member.slug}/${tab.value}`}
              className="whitespace-nowrap px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          className="input text-sm py-1.5 w-full pr-8"
          placeholder="Search title or artist…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm leading-none px-1"
            style={{ color: 'var(--text-muted)' }}
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Owned / Wishlist + Sort */}
      <div className="flex items-center gap-1 sm:gap-2 flex-nowrap">
        <button className={`btn-ghost px-2 sm:px-4 text-xs sm:text-sm ${!isWishlist ? 'active' : ''}`} onClick={() => { setIsWishlist(false); localStorage.setItem(tabStorageKey, 'owned') }}>Owned <span className="opacity-70">({ownedCount})</span></button>
        <button className={`btn-ghost px-2 sm:px-4 text-xs sm:text-sm ${isWishlist ? 'active' : ''}`} onClick={() => { setIsWishlist(true); localStorage.setItem(tabStorageKey, 'wishlist') }}>Wishlist <span className="opacity-70">({wishlistCount})</span></button>
        <div className="ml-auto flex items-center gap-2">
          <span className="label hidden sm:inline">Sort</span>
          <select
            value={sort}
            onChange={e => { const v = e.target.value as SortMode; setSort(v); localStorage.setItem(sortStorageKey, v) }}
            className="input py-1 px-2 text-xs sm:text-sm w-auto"
          >
            <option value="added">Date added</option>
            <option value="creator">{sortCreatorLabel(collection)}</option>
            <option value="title">Title</option>
            <option value="year">Year</option>
            <option value="rating">Rating</option>
            {collection === 'vinyl' && <option value="condition">Condition</option>}
            {(collection === 'book' || collection === 'comic') && <option value="status">Read / Unread</option>}
          </select>
          <button
            onClick={() => {
              const next: ViewMode = viewMode === 'grid' ? 'list' : 'grid'
              setViewMode(next)
              localStorage.setItem(viewStorageKey, next)
            }}
            className="btn-ghost px-2 py-1 text-base"
            title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
            aria-label={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          >
            {viewMode === 'grid' ? '☰' : '⊞'}
          </button>
        </div>
      </div>

      {/* Status filter — own row, segmented control so size never changes */}
      {showStatusFilter && (
        <div className="flex items-center gap-1">
          <button className={`btn-ghost px-2 sm:px-3 py-1 text-xs ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
          <button className={`btn-ghost px-2 sm:px-3 py-1 text-xs ${statusFilter === 'unconsumed' ? 'active' : ''}`} onClick={() => setStatusFilter('unconsumed')}>{collection === 'vinyl' ? 'Unlistened' : 'Unread'}</button>
          <button className={`btn-ghost px-2 sm:px-3 py-1 text-xs ${statusFilter === 'consumed' ? 'active' : ''}`} onClick={() => setStatusFilter('consumed')}>{collection === 'vinyl' ? '✓ Listened' : '✓ Read'}</button>
        </div>
      )}

      {/* Lego build status filter */}
      {showLegoFilter && (
        <div className="flex items-center gap-1">
          <button className={`btn-ghost px-2 sm:px-3 py-1 text-xs ${legoFilter === 'all' ? 'active' : ''}`} onClick={() => setLegoFilter('all')}>All</button>
          <button className={`btn-ghost px-2 sm:px-3 py-1 text-xs ${legoFilter === 'in_box' ? 'active' : ''}`} onClick={() => setLegoFilter('in_box')}>📦 In box</button>
          <button className={`btn-ghost px-2 sm:px-3 py-1 text-xs ${legoFilter === 'built' ? 'active' : ''}`} onClick={() => setLegoFilter('built')}>🔨 Built</button>
          <button className={`btn-ghost px-2 sm:px-3 py-1 text-xs ${legoFilter === 'disassembled' ? 'active' : ''}`} onClick={() => setLegoFilter('disassembled')}>🔧 Apart</button>
        </div>
      )}

      {/* Grid — flat or grouped */}
      <div className={`relative ${hasSidebar ? 'pr-8' : ''}`}>
        {byCreator ? (
          <>
            {creatorGroups.map(g => (
              <div
                key={g.letter}
                ref={el => { sectionRefs.current[g.letter] = el }}
                className="mb-6"
              >
                <h3
                  className="font-serif text-lg font-bold mb-2 px-1"
                  style={{ color: 'var(--accent)' }}
                >
                  {g.letter}
                </h3>
                <div className={viewMode === 'list' ? LIST : GRID}>
                  {g.items.map(item => (
                    <ItemCard key={item.id} item={item} isEditor={isEditor} onUpdate={handleUpdate} onDelete={handleDelete} supabaseUrl={supabaseUrl} layout={viewMode} />
                  ))}
                </div>
              </div>
            ))}
            {sidebarItems.length > 0 && (
              <div className="fixed right-1 top-1/2 -translate-y-1/2 flex flex-col z-20 select-none rounded-full py-1 px-0.5" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-card) 85%, transparent)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 6px var(--shadow)' }}>
                {sidebarItems.map(({ display, key }) => (
                  <button
                    key={key}
                    onClick={() => scrollTo(key)}
                    className="text-xs font-bold leading-tight px-1.5 py-0.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    {display}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : byTitle ? (
          <>
            {titleGroups.map(g => (
              <div
                key={g.letter}
                ref={el => { sectionRefs.current[g.letter] = el }}
                className="mb-6"
              >
                <h3
                  className="font-serif text-lg font-bold mb-2 px-1"
                  style={{ color: 'var(--accent)' }}
                >
                  {g.letter}
                </h3>
                <div className={viewMode === 'list' ? LIST : GRID}>
                  {g.items.map(item => (
                    <ItemCard key={item.id} item={item} isEditor={isEditor} onUpdate={handleUpdate} onDelete={handleDelete} supabaseUrl={supabaseUrl} layout={viewMode} />
                  ))}
                </div>
              </div>
            ))}
            {sidebarItems.length > 0 && (
              <div className="fixed right-1 top-1/2 -translate-y-1/2 flex flex-col z-20 select-none rounded-full py-1 px-0.5" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-card) 85%, transparent)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 6px var(--shadow)' }}>
                {sidebarItems.map(({ display, key }) => (
                  <button
                    key={key}
                    onClick={() => scrollTo(key)}
                    className="text-xs font-bold leading-tight px-1.5 py-0.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    {display}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : byYear ? (
          <>
            {yearGroups.map(g => (
              <div
                key={g.shortKey}
                ref={el => { sectionRefs.current[g.shortKey] = el }}
                className="mb-6"
              >
                <h3
                  className="font-serif text-lg font-bold mb-2 px-1"
                  style={{ color: 'var(--accent)' }}
                >
                  {g.label}
                </h3>
                <div className={viewMode === 'list' ? LIST : GRID}>
                  {g.items.map(item => (
                    <ItemCard key={item.id} item={item} isEditor={isEditor} onUpdate={handleUpdate} onDelete={handleDelete} supabaseUrl={supabaseUrl} layout={viewMode} />
                  ))}
                </div>
              </div>
            ))}
            {sidebarItems.length > 0 && (
              <div className="fixed right-1 top-1/2 -translate-y-1/2 flex flex-col z-20 select-none rounded-full py-1 px-0.5" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-card) 85%, transparent)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 6px var(--shadow)' }}>
                {sidebarItems.map(({ display, key }) => (
                  <button
                    key={key}
                    onClick={() => scrollTo(key)}
                    className="text-xs font-bold leading-tight px-1.5 py-0.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    {display}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : byRating ? (
          <>
            {ratingGroups.map(g => (
              <div key={g.key} className="mb-6">
                <h3
                  className="font-serif text-lg font-bold mb-2 px-1"
                  style={{ color: g.key === '0' ? 'var(--text-muted)' : 'var(--accent)' }}
                >
                  {g.label}
                </h3>
                <div className={viewMode === 'list' ? LIST : GRID}>
                  {g.items.map(item => (
                    <ItemCard key={item.id} item={item} isEditor={isEditor} onUpdate={handleUpdate} onDelete={handleDelete} supabaseUrl={supabaseUrl} layout={viewMode} />
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : byStatus ? (
          <>
            {statusGroups.map(g => (
              <div key={g.label} className="mb-6">
                <h3 className="font-serif text-lg font-bold mb-2 px-1" style={{ color: g.label === 'Read' ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {g.label === 'Read' ? '✓ Read' : g.label}
                </h3>
                <div className={viewMode === 'list' ? LIST : GRID}>
                  {g.items.map(item => (
                    <ItemCard key={item.id} item={item} isEditor={isEditor} onUpdate={handleUpdate} onDelete={handleDelete} supabaseUrl={supabaseUrl} layout={viewMode} />
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : byCondition ? (
          <>
            {conditionGroups.map(g => (
              <div key={g.label} className="mb-6">
                <h3 className="font-serif text-lg font-bold mb-2 px-1 flex items-center gap-2">
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded text-white leading-none"
                    style={{ backgroundColor: g.color }}
                  >
                    {g.abbr}
                  </span>
                  <span style={{ color: g.label === 'Ungraded' ? 'var(--text-muted)' : 'var(--text)' }}>{g.label}</span>
                </h3>
                <div className={viewMode === 'list' ? LIST : GRID}>
                  {g.items.map(item => (
                    <ItemCard key={item.id} item={item} isEditor={isEditor} onUpdate={handleUpdate} onDelete={handleDelete} supabaseUrl={supabaseUrl} layout={viewMode} />
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className={viewMode === 'list' ? LIST : GRID}>
            {displayed.map(item => (
              <ItemCard key={item.id} item={item} isEditor={isEditor} onUpdate={handleUpdate} onDelete={handleDelete} supabaseUrl={supabaseUrl} layout={viewMode} />
            ))}
          </div>
        )}
      </div>

      {/* Infinite scroll sentinel — invisible div that triggers loading the next page */}
      {hasMore && <div ref={sentinelRef} className="h-4" aria-hidden="true" />}

      {/* Floating add button */}
      {isEditor && (
        <Link
          href={`/${member.slug}/${collection}/add`}
          className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          +
        </Link>
      )}

      {sorted.length === 0 && (
        <p className="subtitle text-center py-8">
          {isWishlist
            ? 'No wishlist items yet.'
            : isEditor
              ? 'No items yet. Tap + to add one.'
              : 'No items yet.'}
        </p>
      )}
    </div>
  )
}
