'use client'
import { useState } from 'react'
import ItemCard from './ItemCard'
import type { Item } from '@/lib/types'

interface Props {
  initialItems: Item[]
  isEditor: boolean
  supabaseUrl: string
}

export default function WishlistList({ initialItems, isEditor, supabaseUrl }: Props) {
  const [items, setItems] = useState(initialItems)

  if (items.length === 0) return null

  function handleUpdate(updated: Item) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <ul className="flex flex-col">
      {items.map(item => (
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
    </ul>
  )
}
