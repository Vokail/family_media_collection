'use client'
import Link from 'next/link'
import { useState } from 'react'
import ItemCard from './ItemCard'
import type { Item, CollectionType, Member } from '@/lib/types'

const TABS: { label: string; value: CollectionType }[] = [
  { label: 'Vinyl', value: 'vinyl' },
  { label: 'Books', value: 'book' },
  { label: 'Comics', value: 'comic' },
]

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

  function handleUpdate(updated: Item) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }
  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const displayed = items.filter(i => i.is_wishlist === isWishlist)

  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex gap-2">
        <button className={`btn-ghost ${!isWishlist ? 'active' : ''}`} onClick={() => setIsWishlist(false)}>Owned</button>
        <button className={`btn-ghost ${isWishlist ? 'active' : ''}`} onClick={() => setIsWishlist(true)}>Wishlist</button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {displayed.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            isEditor={isEditor}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            supabaseUrl={supabaseUrl}
          />
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

      {displayed.length === 0 && (
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
