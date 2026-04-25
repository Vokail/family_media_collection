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

// Strip leading articles, then use last word for two-word names (First Last → Last),
// first word for everything else. Matches vinyl/book filing conventions.
function indexKey(creator: string): string {
  const stripped = creator.replace(/^(the|a|an)\s+/i, '').trim()
  const words = stripped.split(/\s+/)
  const word = words.length === 2 ? words[1] : words[0]
  const ch = word?.[0]?.toUpperCase() ?? '#'
  return /[A-Z]/.test(ch) ? ch : '#'
}

function sortKey(creator: string): string {
  const stripped = creator.replace(/^(the|a|an)\s+/i, '').trim()
  const words = stripped.split(/\s+/)
  return (words.length === 2 ? words[1] + ' ' + words[0] : stripped).toLowerCase()
}

function sortItems(items: Item[], mode: SortMode): Item[] {
  const copy = [...items]
  if (mode === 'creator') return copy.sort((a, b) => sortKey(a.creator).localeCompare(sortKey(b.creator)))
  if (mode === 'title') return copy.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
  if (mode === 'year') return copy.sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
  return copy // 'added' — already newest-first from DB
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
  const [sort, setSort] = useState<SortMode>('added')
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  function handleUpdate(updated: Item) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }
  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filtered = items.filter(i => i.is_wishlist === isWishlist)
  const sorted = sortItems(filtered, sort)
  const byCreator = sort === 'creator'

  // Build groups when sorted by creator
  const groups: { letter: string; items: Item[] }[] = []
  if (byCreator) {
    const map = new Map<string, Item[]>()
    for (const item of sorted) {
      const k = indexKey(item.creator)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(item)
    }
    Array.from(map.entries()).forEach(([letter, groupItems]) => {
      groups.push({ letter, items: groupItems })
    })
  }

  const letters = groups.map(g => g.letter)

  function scrollTo(letter: string) {
    sectionRefs.current[letter]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
        <button className={`btn-ghost ${!isWishlist ? 'active' : ''}`} onClick={() => setIsWishlist(false)}>Owned</button>
        <button className={`btn-ghost ${isWishlist ? 'active' : ''}`} onClick={() => setIsWishlist(true)}>Wishlist</button>
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
            {groups.map(g => (
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
            {/* A–Z sidebar */}
            {letters.length > 0 && (
              <div className="fixed right-1 top-1/2 -translate-y-1/2 flex flex-col z-20 select-none">
                {letters.map(l => (
                  <button
                    key={l}
                    onClick={() => scrollTo(l)}
                    className="text-xs font-bold leading-tight px-1 py-0.5"
                    style={{ color: 'var(--accent)' }}
                  >
                    {l}
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
            {isEditor && (
              <Link
                href={`/${member.slug}/${collection}/add`}
                className="aspect-square placeholder-tile flex items-center justify-center text-3xl font-bold hover:opacity-80 transition-opacity"
                style={{ color: 'var(--accent)' }}
              >
                +
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Add button when grouped */}
      {byCreator && isEditor && (
        <Link
          href={`/${member.slug}/${collection}/add`}
          className="aspect-square placeholder-tile flex items-center justify-center text-3xl font-bold hover:opacity-80 transition-opacity w-full max-w-24"
          style={{ color: 'var(--accent)' }}
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
