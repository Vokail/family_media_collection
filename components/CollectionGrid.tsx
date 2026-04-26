'use client'
import Link from 'next/link'
import { useState, useRef } from 'react'
import ItemCard from './ItemCard'
import type { Item, CollectionType, Member } from '@/lib/types'

type SortMode = 'added' | 'creator' | 'title' | 'year'

const TABS: { label: string; value: CollectionType }[] = [
  { label: 'Vinyl', value: 'vinyl' },
  { label: 'Books', value: 'book' },
  { label: 'Comics', value: 'comic' },
]

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'added', label: 'Date added' },
  { value: 'creator', label: 'Artist / Author' },
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
]

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

// Use Discogs sort_name when available (e.g. "Sinatra, Frank"), else strip leading articles.
function indexKey(creator: string, sortName?: string | null): string {
  const base = sortName ?? creator.replace(/^(the|a|an)\s+/i, '').trim()
  const ch = base[0]?.toUpperCase() ?? '#'
  return /[A-Z]/.test(ch) ? ch : '#'
}

function sortKey(creator: string, sortName?: string | null): string {
  return (sortName ?? creator.replace(/^(the|a|an)\s+/i, '').trim()).toLowerCase()
}

function sortItems(items: Item[], mode: SortMode): Item[] {
  const copy = [...items]
  if (mode === 'creator') return copy.sort((a, b) => sortKey(a.creator, a.sort_name).localeCompare(sortKey(b.creator, b.sort_name)))
  if (mode === 'title') return copy.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
  if (mode === 'year') return copy.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))
  return copy // 'added' — already newest-first from DB
}

interface YearGroup { label: string; shortKey: string; items: Item[] }

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

interface Props {
  member: Member
  collection: CollectionType
  initialItems: Item[]
  isEditor: boolean
  supabaseUrl: string
}

export default function CollectionGrid({ member, collection, initialItems, isEditor, supabaseUrl }: Props) {
  const [isWishlist, setIsWishlist] = useState(false)
  const [items, setItems] = useState(initialItems)
  const [sort, setSort] = useState<SortMode>('creator')
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  function handleUpdate(updated: Item) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }
  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const ownedCount = items.filter(i => !i.is_wishlist).length
  const wishlistCount = items.filter(i => i.is_wishlist).length
  const filtered = items.filter(i => i.is_wishlist === isWishlist)
  const sorted = sortItems(filtered, sort)
  const byCreator = sort === 'creator'
  const byYear = sort === 'year'

  // Build groups when sorted by creator
  const creatorGroups: { letter: string; items: Item[] }[] = []
  if (byCreator) {
    const map = new Map<string, Item[]>()
    for (const item of sorted) {
      const k = indexKey(item.creator, item.sort_name)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(item)
    }
    Array.from(map.entries()).forEach(([letter, groupItems]) => {
      creatorGroups.push({ letter, items: groupItems })
    })
  }

  const yearGroups: YearGroup[] = byYear ? buildYearGroups(sorted) : []

  const sidebarKeys = byCreator ? creatorGroups.map(g => g.letter) : yearGroups.map(g => g.shortKey)

  function scrollTo(key: string) {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(tab => {
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

      {/* Owned / Wishlist + Sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <button className={`btn-ghost ${!isWishlist ? 'active' : ''}`} onClick={() => setIsWishlist(false)}>Owned <span className="opacity-70">({ownedCount})</span></button>
        <button className={`btn-ghost ${isWishlist ? 'active' : ''}`} onClick={() => setIsWishlist(true)}>Wishlist <span className="opacity-70">({wishlistCount})</span></button>
        <div className="ml-auto flex items-center gap-2">
          <span className="label">Sort</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            className="input py-1 px-2 text-sm w-auto"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Grid — flat or grouped */}
      <div className="relative">
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
                <div className={GRID}>
                  {g.items.map(item => (
                    <ItemCard key={item.id} item={item} isEditor={isEditor} onUpdate={handleUpdate} onDelete={handleDelete} supabaseUrl={supabaseUrl} />
                  ))}
                </div>
              </div>
            ))}
            {sidebarKeys.length > 0 && (
              <div className="fixed right-1 top-1/2 -translate-y-1/2 flex flex-col z-20 select-none">
                {sidebarKeys.map(k => (
                  <button
                    key={k}
                    onClick={() => scrollTo(k)}
                    className="text-xs font-bold leading-tight px-1 py-0.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    {k}
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
                <div className={GRID}>
                  {g.items.map(item => (
                    <ItemCard key={item.id} item={item} isEditor={isEditor} onUpdate={handleUpdate} onDelete={handleDelete} supabaseUrl={supabaseUrl} />
                  ))}
                </div>
              </div>
            ))}
            {sidebarKeys.length > 0 && (
              <div className="fixed right-1 top-1/2 -translate-y-1/2 flex flex-col z-20 select-none">
                {sidebarKeys.map(k => (
                  <button
                    key={k}
                    onClick={() => scrollTo(k)}
                    className="text-xs font-bold leading-tight px-1 py-0.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className={GRID}>
            {sorted.map(item => (
              <ItemCard key={item.id} item={item} isEditor={isEditor} onUpdate={handleUpdate} onDelete={handleDelete} supabaseUrl={supabaseUrl} />
            ))}
          </div>
        )}
      </div>

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
