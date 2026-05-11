/**
 * ManualEntryForm — collapsible manual-add form.
 *
 * Owns all manual-entry state (title, creator, year, isbn, cover, dupe confirm).
 * Exposed imperatively via ManualEntryFormHandle so the parent can open the
 * form and pre-fill fields from barcode / OCR results without prop drilling.
 */
'use client'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import PhotoCapture from '@/components/PhotoCapture'
import { useToast } from '@/components/Toast'
import type { CollectionType, Item } from '@/lib/types'

export interface ManualEntryFormHandle {
  /** Open (expand) the manual form */
  open(): void
  /** Open the form and optionally pre-fill one or more fields */
  prefill(fields: {
    isbn?: string
    title?: string
    creator?: string
    cover?: File
  }): void
}

interface PendingDupe {
  isWishlist: boolean
  existing: { id: string; title: string; creator: string; year: number | null }
}

interface ManualEntryFormProps {
  collection: CollectionType
  member: string
  /** File captured by cover-OCR; auto-filled into the cover field when the user
   *  opens the form after a successful OCR run. */
  scanCover: File | null
  goToCollection: () => void
  /** Called after a successful add — parent updates its existingItems state */
  onAdded: (item: Item) => void
  /** Parent schedules the auto-navigate timer */
  scheduleNav: () => void
}

const ManualEntryForm = forwardRef<ManualEntryFormHandle, ManualEntryFormProps>(
  function ManualEntryForm(
    { collection, member, scanCover, goToCollection, onAdded, scheduleNav },
    ref,
  ) {
    const toast = useToast()

    const [showManual, setShowManual] = useState(false)
    const [manualTitle, setManualTitle] = useState('')
    const [manualCreator, setManualCreator] = useState('')
    const [manualYear, setManualYear] = useState('')
    const [manualIsbn, setManualIsbn] = useState('')
    const [manualCover, setManualCover] = useState<File | null>(null)
    const [addingManual, setAddingManual] = useState(false)
    const [showManualCamera, setShowManualCamera] = useState(false)
    const [pendingDupe, setPendingDupe] = useState<PendingDupe | null>(null)
    const manualFileRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      open() {
        setShowManual(true)
      },
      prefill({ isbn, title, creator, cover } = {}) {
        setShowManual(true)
        if (isbn !== undefined) setManualIsbn(isbn)
        if (title !== undefined) setManualTitle(title)
        if (creator !== undefined) setManualCreator(creator)
        if (cover !== undefined) setManualCover(cover)
      },
    }))

    async function handleManualAdd(isWishlist: boolean, force = false) {
      if (!manualTitle.trim()) return
      setAddingManual(true)
      setPendingDupe(null)

      const body = new FormData()
      body.append('memberSlug', member)
      body.append('collection', collection)
      body.append('title', manualTitle.trim())
      body.append('creator', manualCreator.trim())
      body.append('year', manualYear)
      body.append('is_wishlist', String(isWishlist))
      if (manualIsbn) body.append('isbn', manualIsbn)
      if (manualCover) body.append('cover', manualCover)
      if (force) body.append('force', 'true')

      const res = await fetch('/api/items/manual', { method: 'POST', body })
      setAddingManual(false)

      if (res.status === 409) {
        const { existing } = await res.json()
        setPendingDupe({ isWishlist, existing })
        return
      }

      if (res.ok) {
        const added = await res.json()
        onAdded(added)
        // Reset form
        setManualTitle('')
        setManualCreator('')
        setManualYear('')
        setManualIsbn('')
        setManualCover(null)
        setShowManual(false)
        toast.show(
          isWishlist ? 'Added to wishlist' : 'Added to collection',
          'success',
          { label: 'View collection', onClick: goToCollection },
        )
        scheduleNav()
      } else {
        toast.show('Could not add item', 'error')
      }
    }

    const creatorLabel =
      collection === 'vinyl'
        ? 'Artist'
        : collection === 'lego'
          ? 'Theme'
          : 'Author / Publisher'

    function handleToggle() {
      const next = !showManual
      setShowManual(next)
      // Auto-fill cover from the OCR scan when first opening the form
      if (next && scanCover && !manualCover) setManualCover(scanCover)
    }

    return (
      <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={handleToggle}
          className="btn-ghost text-sm w-full text-center"
        >
          {showManual ? 'Hide manual entry' : 'Not found? Add manually'}
        </button>

        {showManual && (
          <div className="card p-4 mt-3 flex flex-col gap-3">
            {/* Title */}
            <div>
              <label className="label mb-1 block">Title *</label>
              <input
                className="input"
                value={manualTitle}
                onChange={e => setManualTitle(e.target.value)}
                placeholder="Title"
              />
            </div>

            {/* Swap button */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  const t = manualTitle
                  setManualTitle(manualCreator)
                  setManualCreator(t)
                }}
                className="btn-ghost text-xs px-3 py-1"
                title="Swap title and author"
              >
                ⇅ Swap title &amp; author
              </button>
            </div>

            {/* Creator */}
            <div>
              <label className="label mb-1 block">{creatorLabel}</label>
              <input
                className="input"
                value={manualCreator}
                onChange={e => setManualCreator(e.target.value)}
                placeholder="Creator"
              />
            </div>

            {/* Year */}
            <div>
              <label className="label mb-1 block">Year</label>
              <input
                className="input"
                type="number"
                value={manualYear}
                onChange={e => setManualYear(e.target.value)}
                placeholder="e.g. 2023"
              />
            </div>

            {/* ISBN (books and comics only, or if already set) */}
            {(collection === 'book' || collection === 'comic' || manualIsbn) && (
              <div>
                <label className="label mb-1 block">ISBN (for future auto-fill)</label>
                <input
                  className="input font-mono text-sm"
                  value={manualIsbn}
                  onChange={e => setManualIsbn(e.target.value)}
                  placeholder="e.g. 9781234567890"
                />
              </div>
            )}

            {/* Cover */}
            <div>
              <label className="label mb-1 block">Cover image (optional)</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowManualCamera(true)}
                  className="btn-ghost text-xs md:hidden"
                >
                  📷
                </button>
                <button
                  onClick={() => manualFileRef.current?.click()}
                  className="btn-ghost text-xs"
                >
                  {manualCover ? manualCover.name : 'Add cover…'}
                </button>
                <input
                  ref={manualFileRef}
                  type="file"
                  accept="image/*"
                  onChange={e => setManualCover(e.target.files?.[0] ?? null)}
                  style={{
                    position: 'fixed',
                    top: '-100vh',
                    left: 0,
                    opacity: 0,
                    pointerEvents: 'none',
                  }}
                />
                {manualCover && (
                  <button
                    onClick={() => setManualCover(null)}
                    className="text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Duplicate confirmation */}
            {pendingDupe && (
              <div
                className="card p-3 flex flex-col gap-2"
                style={{ borderColor: 'var(--accent)' }}
              >
                <p className="text-sm font-semibold">Already in collection</p>
                <p className="subtitle text-sm">
                  &ldquo;{pendingDupe.existing.title}&rdquo;
                  {pendingDupe.existing.creator
                    ? ` by ${pendingDupe.existing.creator}`
                    : ''}
                  {pendingDupe.existing.year
                    ? ` (${pendingDupe.existing.year})`
                    : ''}{' '}
                  is already in this collection.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleManualAdd(pendingDupe.isWishlist, true)}
                    className="btn-ghost text-sm flex-1"
                    disabled={addingManual}
                  >
                    Add anyway
                  </button>
                  <button
                    onClick={() => setPendingDupe(null)}
                    className="btn-ghost text-sm flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleManualAdd(false)}
                disabled={addingManual || !manualTitle.trim()}
                className="btn-primary flex-1"
              >
                {addingManual ? '…' : 'Add to collection'}
              </button>
              <button
                onClick={() => handleManualAdd(true)}
                disabled={addingManual || !manualTitle.trim()}
                className="btn-ghost flex-1"
              >
                Add to wishlist
              </button>
            </div>
          </div>
        )}

        {showManualCamera && (
          <PhotoCapture
            onCapture={file => {
              setManualCover(file)
              setShowManualCamera(false)
            }}
            onClose={() => setShowManualCamera(false)}
          />
        )}
      </div>
    )
  },
)

export default ManualEntryForm
