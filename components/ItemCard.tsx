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
  initialOpen?: boolean
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

export default function ItemCard({ item, isEditor, onUpdate, onDelete, supabaseUrl, layout = 'grid', initialOpen = false }: Props) {
  const toast = useToast()
  const [open, setOpen] = useState(initialOpen)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
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

  const statusLabel = item.collection === 'vinyl' ? 'Listened' : 'Read'
  const consumed = item.status === 'consumed'

  async function toggleStatus() {
    const newStatus = consumed ? null : 'consumed'
    onUpdate({ ...item, status: newStatus })
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      onUpdate(await res.json())
      toast.show(newStatus ? `Marked as ${statusLabel.toLowerCase()}` : `Marked as un${statusLabel.toLowerCase()}`)
    } else {
      onUpdate(item)
      toast.show('Could not update item', 'error')
    }
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
    if (res.ok) {
      onUpdate(await res.json())
      toast.show('Note saved')
    } else {
      toast.show('Could not save note', 'error')
    }
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

  const LEGO_STATUS_OPTIONS = [
    { value: 'in_box',       label: '📦 In box' },
    { value: 'built',        label: '🏗 Built' },
    { value: 'disassembled', label: '🔧 Apart' },
  ] as const

  async function setLegoStatus(value: 'built' | 'in_box' | 'disassembled' | null) {
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lego_status: value }),
    })
    if (res.ok) onUpdate(await res.json())
  }

  const legoStatusLabel = item.lego_status === 'built' ? '🏗 Built'
    : item.lego_status === 'in_box' ? '📦 In box'
    : item.lego_status === 'disassembled' ? '🔧 Apart'
    : null

  return (
    <>
      {layout === 'list' ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:opacity-80 transition-opacity"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden shadow" style={{ backgroundColor: 'var(--border)' }}>
            {coverSrc ? (
              <Image src={coverSrc} alt={item.title} width={48} height={48} className="w-full h-full object-cover" />
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
            {consumed && item.collection !== 'lego' && (
              <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>✓</span>
            )}
            {item.rating && (
              <span className="text-xs" style={{ color: 'var(--accent)' }}>{'★'.repeat(item.rating)}</span>
            )}
            {item.collection === 'lego' && legoStatusLabel && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{legoStatusLabel}</span>
            )}
          </div>
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full aspect-square relative">
          {coverSrc ? (
            <div className="relative w-full h-full rounded-lg overflow-hidden shadow-md" style={{ backgroundColor: 'var(--border)' }}>
              <Image
                src={coverSrc}
                alt={item.title}
                width={200}
                height={200}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="placeholder-tile w-full h-full flex-col gap-1 px-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <span className="text-2xl">{emoji}</span>
              <p className="text-xs font-semibold leading-tight text-center line-clamp-3 w-full" style={{ color: 'var(--text)' }}>{item.title}</p>
              {item.creator && <p className="text-[10px] leading-tight text-center line-clamp-2 w-full">{item.creator}</p>}
            </div>
          )}
          {item.rating && (
            <>
              <div className="absolute bottom-0 left-0 right-0 h-8 rounded-b-lg pointer-events-none" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.55))' }} />
              <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <span key={s} className="text-xs leading-none drop-shadow" style={{ color: s <= item.rating! ? '#f5a623' : 'rgba(255,255,255,0.4)' }}>★</span>
                ))}
              </div>
            </>
          )}
          {showNewBadge && (
            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-white text-[10px] font-bold leading-none" style={{ backgroundColor: 'var(--accent)' }}>
              NEW
            </div>
          )}
          {consumed && item.collection !== 'lego' && (
            <div className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow" style={{ backgroundColor: 'var(--accent)' }}>
              ✓
            </div>
          )}
          {item.collection === 'lego' && legoStatusLabel && (
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-white text-[9px] font-bold leading-none shadow"
              style={{ backgroundColor: item.lego_status === 'built' ? 'var(--accent)' : 'rgba(44,26,14,0.65)' }}>
              {legoStatusLabel}
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
            {item.collection === 'vinyl' && (item.genres || item.styles) && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {item.genres && item.genres.split(', ').map(g => (
                  <span key={g} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, var(--bg-card))', color: 'var(--accent)' }}>{g}</span>
                ))}
                {item.styles && item.styles.split(', ').map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>{s}</span>
                ))}
              </div>
            )}
            <StarRating rating={item.rating} onRate={isEditor ? setRating : undefined} />
            {isEditor && !item.is_wishlist && item.collection !== 'lego' && (
              <button
                onClick={toggleStatus}
                className="btn-ghost text-sm self-center"
                style={consumed ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
              >
                {consumed ? `✓ ${statusLabel}` : `Mark as ${statusLabel.toLowerCase()}`}
              </button>
            )}
            {isEditor && item.collection === 'lego' && (
              <div className="flex flex-col gap-2">
                <p className="label text-center">Build status</p>
                <div className="flex gap-2 justify-center">
                  {LEGO_STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setLegoStatus(item.lego_status === opt.value ? null : opt.value)}
                      className="btn-ghost text-xs px-3 py-1.5"
                      style={item.lego_status === opt.value ? { backgroundColor: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : {}}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
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
                  <button onClick={() => setShowCamera(true)} disabled={uploadingCover} className="btn-ghost text-xs md:hidden">
                    {uploadingCover ? 'Uploading…' : '📷'}
                  </button>
                  <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} className="btn-ghost text-xs">
                    {coverSrc ? 'Replace cover' : 'Add cover'}
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
