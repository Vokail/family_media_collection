'use client'
import { useState } from 'react'
import Image from 'next/image'
import type { ActivityItem, Item } from '@/lib/types'
import { relativeTime } from '@/lib/utils'
import ItemCard from './ItemCard'

const EMOJI: Record<string, string> = {
  vinyl: '🎵',
  book: '📚',
  comic: '🦸',
  lego: '🧱',
}

interface Props {
  items: ActivityItem[]
  supabaseUrl: string
}

export default function ActivityFeed({ items, supabaseUrl }: Props) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  if (!items.length) return null

  async function handleTap(id: string) {
    setLoading(id)
    try {
      const res = await fetch(`/api/items/${id}`)
      if (res.ok) setSelectedItem(await res.json())
    } finally {
      setLoading(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-lg font-semibold">Recently added</h2>
      <div className="flex flex-col">
        {items.map(item => {
          const coverSrc = item.cover_path
            ? `${supabaseUrl}/storage/v1/object/public/${item.cover_path}`
            : null
          const isLoading = loading === item.id
          return (
            <button
              key={item.id}
              onClick={() => handleTap(item.id)}
              disabled={isLoading}
              className="flex items-center gap-3 py-2.5 text-left hover:opacity-80 transition-opacity w-full disabled:opacity-50"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="relative w-10 h-10 flex-shrink-0 rounded overflow-hidden"
                style={{ backgroundColor: 'var(--border)' }}
              >
                {coverSrc ? (
                  <Image src={coverSrc} alt={item.title} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base">
                    {isLoading ? '…' : (EMOJI[item.collection] ?? '📦')}
                  </div>
                )}
                {isLoading && coverSrc && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs">…</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{item.title}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {item.member_name} · {relativeTime(item.created_at)}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {selectedItem && (
        <ItemCard
          key={selectedItem.id}
          item={selectedItem}
          isEditor={false}
          onUpdate={updated => setSelectedItem(updated)}
          onDelete={() => setSelectedItem(null)}
          supabaseUrl={supabaseUrl}
          layout="list"
          initialOpen={true}
        />
      )}
    </section>
  )
}
