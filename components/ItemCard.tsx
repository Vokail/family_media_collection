'use client'
import Image from 'next/image'
import { useState } from 'react'
import type { Item } from '@/lib/types'

interface Props {
  item: Item
  isEditor: boolean
  onUpdate: (updated: Item) => void
  onDelete: (id: string) => void
  supabaseUrl: string
}

export default function ItemCard({ item, isEditor, onUpdate, onDelete, supabaseUrl }: Props) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const coverSrc = item.cover_path
    ? `${supabaseUrl}/storage/v1/object/public/${item.cover_path}`
    : null

  async function toggleWishlist() {
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_wishlist: !item.is_wishlist }),
    })
    if (res.ok) onUpdate(await res.json())
  }

  async function saveNotes() {
    setSavingNotes(true)
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    if (res.ok) onUpdate(await res.json())
    setSavingNotes(false)
  }

  async function handleDelete() {
    await fetch(`/api/items/${item.id}`, { method: 'DELETE' })
    onDelete(item.id)
    setOpen(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="w-full aspect-square">
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={item.title}
            width={200}
            height={200}
            className="w-full h-full object-cover rounded-lg shadow-md"
          />
        ) : (
          <div className="placeholder-tile w-full h-full text-2xl" style={{ color: 'var(--text-muted)' }}>
            {item.collection === 'vinyl' ? '🎵' : item.collection === 'book' ? '📚' : '🦸'}
          </div>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={() => setOpen(false)}>
          <div
            className="card w-full rounded-b-none p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {coverSrc && (
              <Image src={coverSrc} alt={item.title} width={120} height={120} className="rounded-lg shadow mx-auto" />
            )}
            <h2 className="font-serif text-xl font-bold text-center">{item.title}</h2>
            <p className="text-center subtitle">{item.creator}{item.year ? ` · ${item.year}` : ''}</p>
            {isEditor ? (
              <>
                <div>
                  <label className="label mb-1 block">Notes</label>
                  <textarea
                    className="input resize-none h-20"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add a personal note…"
                  />
                  <button onClick={saveNotes} disabled={savingNotes} className="btn-ghost text-xs mt-2">
                    {savingNotes ? 'Saving…' : 'Save note'}
                  </button>
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={toggleWishlist} className="btn-ghost">
                    {item.is_wishlist ? 'Mark as Owned' : 'Move to Wishlist'}
                  </button>
                  <button onClick={handleDelete} className="btn-ghost text-red-500">Delete</button>
                </div>
              </>
            ) : (
              notes && <p className="subtitle text-sm text-center italic">"{notes}"</p>
            )}
            <button onClick={() => setOpen(false)} className="btn-ghost w-full text-center">Close</button>
          </div>
        </div>
      )}
    </>
  )
}
