'use client'
import { useState, useMemo } from 'react'
import WishlistList from './WishlistList'
import type { Item, Member, CollectionType } from '@/lib/types'

const COLLECTION_LABELS: { value: CollectionType; label: string }[] = [
  { value: 'vinyl', label: 'Vinyl' },
  { value: 'book', label: 'Books' },
  { value: 'comic', label: 'Comics' },
  { value: 'lego', label: 'Lego' },
]

interface Props {
  members: Member[]
  initialItems: Item[]
  isEditor: boolean
  supabaseUrl: string
}

export default function WishlistFilter({ members, initialItems, isEditor, supabaseUrl }: Props) {
  const [query, setQuery] = useState('')
  const [collectionFilter, setCollectionFilter] = useState<CollectionType | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initialItems.filter(item => {
      if (collectionFilter && item.collection !== collectionFilter) return false
      if (q && !item.title.toLowerCase().includes(q) && !(item.creator ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [initialItems, query, collectionFilter])

  const byMember = useMemo(
    () =>
      members
        .map(m => ({ member: m, items: filtered.filter(i => i.member_id === m.id) }))
        .filter(g => g.items.length > 0),
    [members, filtered],
  )

  const totalCount = filtered.length

  return (
    <>
      {/* Search + filter controls */}
      <div className="flex flex-col gap-3 mb-6">
        <input
          type="search"
          className="input"
          placeholder="Search by title or creator…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          <button
            className={`btn-ghost text-sm${collectionFilter === null ? ' active' : ''}`}
            onClick={() => setCollectionFilter(null)}
          >
            All
          </button>
          {COLLECTION_LABELS.map(({ value, label }) => (
            <button
              key={value}
              className={`btn-ghost text-sm${collectionFilter === value ? ' active' : ''}`}
              onClick={() => setCollectionFilter(prev => (prev === value ? null : value))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Result count when filtering */}
      {(query || collectionFilter) && (
        <p className="subtitle text-sm mb-4">
          {totalCount} item{totalCount !== 1 ? 's' : ''} matched
        </p>
      )}

      {byMember.length === 0 && (
        <p className="subtitle text-center py-16">
          {query || collectionFilter ? 'No items match your search.' : 'No wishlist items yet.'}
        </p>
      )}

      {byMember.map(({ member, items }) => (
        <section key={member.id} className="mb-8">
          <h2 className="font-serif text-lg font-bold mb-3 flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {member.name[0]}
            </span>
            {member.name}
            <span className="subtitle text-sm font-normal">({items.length})</span>
          </h2>
          <WishlistList
            initialItems={items}
            isEditor={isEditor}
            supabaseUrl={supabaseUrl}
          />
        </section>
      ))}
    </>
  )
}
