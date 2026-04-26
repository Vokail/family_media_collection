'use client'
import Image from 'next/image'
import { useState, useRef } from 'react'
import type { Item, Track } from '@/lib/types'
import PhotoCapture from './PhotoCapture'

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
  const [uploadingCover, setUploadingCover] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
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

  async function handleRemoveCover() {
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover_path: null }),
    })
    if (res.ok) onUpdate(await res.json())
  }

  async function uploadCoverFile(file: File) {
    setUploadingCover(true)
    const form = new FormData()
    form.append('cover', file)
    const res = await fetch(`/api/items/${item.id}/cover`, { method: 'POST', body: form })
    if (res.ok) onUpdate(await res.json())
    setUploadingCover(false)
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadCoverFile(file)
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
            {item.collection === 'vinyl' ? '🎵' : item.collection === 'book' ? '📚' : item.collection === 'lego' ? '🧱' : '🦸'}
          </div>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={() => setOpen(false)}>
          <div
            className="card w-full rounded-b-none flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-end p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setOpen(false)} className="btn-ghost px-3 py-1 text-sm">✕ Close</button>
            </div>
            <div className="p-6 flex flex-col gap-4 overflow-y-auto">
            {coverSrc && (
              <Image src={coverSrc} alt={item.title} width={120} height={120} className="rounded-lg shadow mx-auto" />
            )}
            <h2 className="font-serif text-xl font-bold text-center">{item.title}</h2>
            <p className="text-center subtitle">{item.creator}{item.year ? ` · ${item.year}` : ''}</p>
            {item.collection === 'lego' && item.external_id && (
              <p className="text-center text-xs font-mono" style={{ color: 'var(--text-muted)' }}>#{item.external_id}</p>
            )}
            {item.collection === 'book' && item.isbn && (
              <p className="text-center text-xs font-mono" style={{ color: 'var(--text-muted)' }}>ISBN {item.isbn}</p>
            )}
            {item.description && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.description}</p>
            )}
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
                <div className="flex gap-3 justify-center flex-wrap">
                  <button onClick={toggleWishlist} className="btn-ghost">
                    {item.is_wishlist ? 'Mark as Owned' : 'Move to Wishlist'}
                  </button>
                  <button onClick={() => setShowCamera(true)} disabled={uploadingCover} className="btn-ghost text-xs">
                    {uploadingCover ? 'Uploading…' : '📷'}
                  </button>
                  <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} className="btn-ghost text-xs">
                    {coverSrc ? 'Replace' : 'Library'}
                  </button>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    style={{ position: 'fixed', top: '-100vh', left: 0, opacity: 0, pointerEvents: 'none' }}
                  />
                  {coverSrc && (
                    <button onClick={handleRemoveCover} className="btn-ghost text-xs" style={{ color: 'var(--text-muted)' }}>
                      Remove cover
                    </button>
                  )}
                  <button onClick={handleDelete} className="btn-ghost text-red-500">Delete</button>
                </div>
              </>
            ) : (
              notes && <p className="subtitle text-sm text-center italic">&ldquo;{notes}&rdquo;</p>
            )}
            {item.tracklist && item.tracklist.length > 0 && (
              <div>
                <p className="label mb-2 block">Tracklist</p>
                <ol className="flex flex-col gap-1">
                  {item.tracklist.map((track: Track, i: number) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="subtitle w-8 flex-shrink-0">{track.position || i + 1}</span>
                      <span className="flex-1">{track.title}</span>
                      {track.duration && <span className="subtitle flex-shrink-0">{track.duration}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            </div>
          </div>
        </div>
      )}
      {showCamera && (
        <PhotoCapture
          onCapture={file => { setShowCamera(false); uploadCoverFile(file) }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  )
}
