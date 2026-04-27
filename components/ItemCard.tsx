'use client'
import Image from 'next/image'
import { useState, useRef } from 'react'
import type { Item, Track } from '@/lib/types'
import PhotoCapture from './PhotoCapture'
import { useToast } from './Toast'
import { isNew } from '@/lib/utils'

interface Props {
  item: Item
  isEditor: boolean
  onUpdate: (updated: Item) => void
  onDelete: (id: string) => void
  supabaseUrl: string
  layout?: 'grid' | 'list'
}

function StarRating({ rating, onRate }: { rating: number | null; onRate?: (r: number | null) => void }) {
  return (
    <div className="flex gap-1 justify-center">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={onRate ? () => onRate(star === rating ? null : star) : undefined}
          disabled={!onRate}
          className="text-2xl leading-none disabled:cursor-default"
          style={{ color: star <= (rating ?? 0) ? 'var(--accent)' : 'var(--border)' }}
        >★</button>
      ))}
    </div>
  )
}

export default function ItemCard({ item, isEditor, onUpdate, onDelete, supabaseUrl, layout = 'grid' }: Props) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const coverSrc = item.cover_path
    ? `${supabaseUrl}/storage/v1/object/public/${item.cover_path}`
    : null
  const showNewBadge = item.created_at ? isNew(item.created_at) : false

  async function setRating(rating: number | null) {
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    })
    if (res.ok) onUpdate(await res.json())
  }

  async function toggleWishlist() {
    onUpdate({ ...item, is_wishlist: !item.is_wishlist })
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_wishlist: !item.is_wishlist }),
    })
    if (res.ok) {
      onUpdate(await res.json())
      toast.show(item.is_wishlist ? 'Moved to collection' : 'Added to wishlist')
    } else {
      onUpdate(item)
      toast.show('Could not update item', 'error')
    }
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
    const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.show('Item deleted')
      onDelete(item.id)
      setOpen(false)
    } else {
      toast.show('Could not delete item', 'error')
    }
  }

  const emoji = item.collection === 'vinyl' ? '🎵' : item.collection === 'book' ? '📚' : item.collection === 'lego' ? '🧱' : '🦸'

  return (
    <>
      {layout === 'list' ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:opacity-80 transition-opacity"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden shadow">
            {coverSrc ? (
              <>
                <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: 'var(--border)', opacity: imgLoaded ? 0 : 1, transition: 'opacity 0.3s' }} />
                <Image src={coverSrc} alt={item.title} width={48} height={48} className="w-full h-full object-cover" onLoad={() => setImgLoaded(true)} style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }} />
              </>
            ) : (
              <div className="placeholder-tile w-full h-full text-lg" style={{ color: 'var(--text-muted)' }}>{emoji}</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{item.title}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{item.creator}{item.year ? ` · ${item.year}` : ''}</p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            {showNewBadge && (
              <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold leading-none" style={{ backgroundColor: 'var(--accent)' }}>NEW</span>
            )}
            {item.rating && (
              <span className="text-xs" style={{ color: 'var(--accent)' }}>{'★'.repeat(item.rating)}</span>
            )}
          </div>
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full aspect-square relative">
          {coverSrc ? (
            <div className="relative w-full h-full rounded-lg overflow-hidden shadow-md">
              <div
                className="absolute inset-0 animate-pulse"
                style={{ backgroundColor: 'var(--border)', opacity: imgLoaded ? 0 : 1, transition: 'opacity 0.3s' }}
              />
              <Image
                src={coverSrc}
                alt={item.title}
                width={200}
                height={200}
                className="w-full h-full object-cover"
                onLoad={() => setImgLoaded(true)}
                style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
              />
            </div>
          ) : (
            <div className="placeholder-tile w-full h-full text-2xl" style={{ color: 'var(--text-muted)' }}>
              {emoji}
            </div>
          )}
          {item.rating && (
            <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-0.5">
              {[1,2,3,4,5].map(s => (
                <span key={s} className="text-xs leading-none" style={{ color: s <= item.rating! ? 'var(--accent)' : 'rgba(255,255,255,0.3)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>★</span>
              ))}
            </div>
          )}
          {showNewBadge && (
            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-white text-[10px] font-bold leading-none" style={{ backgroundColor: 'var(--accent)' }}>
              NEW
            </div>
          )}
        </button>
      )}

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
              <p className="text-sm leading-relaxed break-words" style={{ color: 'var(--text-muted)', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{item.description}</p>
            )}
            <StarRating rating={item.rating} onRate={isEditor ? setRating : undefined} />
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
                  <button onClick={() => setShowCamera(true)} disabled={uploadingCover} className="btn-ghost text-xs md:hidden">
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
