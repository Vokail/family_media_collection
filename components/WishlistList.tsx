'use client'
import { useState, useEffect, useRef } from 'react'
import ItemCard from './ItemCard'
import type { Item } from '@/lib/types'

const PAGE_SIZE = 60

interface Props {
  initialItems: Item[]
  isEditor: boolean
  supabaseUrl: string
}

export default function WishlistList({ initialItems, isEditor, supabaseUrl }: Props) {
  const [items, setItems] = useState(initialItems)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLLIElement | null>(null)

  // Sync when the parent filter changes the set of items passed in; reset pagination
  useEffect(() => {
    setItems(initialItems)
    setVisibleCount(PAGE_SIZE)
  }, [initialItems])

  // Infinite scroll — load next page when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + PAGE_SIZE) },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [items.length])

  if (items.length === 0) return null

  const displayed = items.slice(0, visibleCount)
  const hasMore = items.length > visibleCount

  function handleUpdate(updated: Item) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <ul className="flex flex-col">
      {displayed.map(item => (
        <li key={item.id}>
          <ItemCard
            item={item}
            isEditor={isEditor}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            supabaseUrl={supabaseUrl}
            layout="list"
          />
        </li>
      ))}
      {hasMore && <li ref={sentinelRef} className="h-4" aria-hidden="true" />}
    </ul>
  )
}
