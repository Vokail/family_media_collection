/**
 * ScanPicker — bottom sheet that lets the user choose between
 * barcode scanning and cover-OCR capture.
 * Pure presentational: all state lives in the parent.
 */
import type { CollectionType } from '@/lib/types'

interface ScanPickerProps {
  show: boolean
  collection: CollectionType
  identifying: boolean
  onClose: () => void
  onBarcodeRequest: () => void
  onCoverOCRRequest: () => void
}

export default function ScanPicker({
  show,
  collection,
  identifying,
  onClose,
  onBarcodeRequest,
  onCoverOCRRequest,
}: ScanPickerProps) {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end z-50"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl p-6 flex flex-col gap-3"
        style={{ backgroundColor: 'var(--bg-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="font-serif text-base font-semibold text-center mb-1">
          What do you want to scan?
        </p>

        <button
          className="btn-ghost text-sm py-3 w-full text-center"
          onClick={onBarcodeRequest}
        >
          📦 Scan barcode
        </button>

        {collection !== 'lego' && (
          <button
            className="btn-ghost text-sm py-3 w-full text-center"
            onClick={onCoverOCRRequest}
            disabled={identifying}
          >
            🖼 Scan cover (OCR)
          </button>
        )}

        <button
          className="btn-ghost text-sm py-2 w-full text-center"
          style={{ color: 'var(--text-muted)' }}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
