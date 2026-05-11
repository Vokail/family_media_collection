'use client'
import Image from 'next/image'
import type { SearchResult } from '@/lib/types'

interface Props {
  result: SearchResult
  onClose: () => void
}

export default function LegoDetailModal({ result, onClose }: Props) {
  const setNum = result.external_id

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${result.title} details`}>
      <div
        className="card w-full rounded-b-none flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-end p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="btn-ghost px-3 py-1 text-sm">✕ Close</button>
        </div>
        <div className="p-5 flex flex-col gap-4 overflow-y-auto items-center">
          {result.cover_url ? (
            <Image src={result.cover_url} alt={result.title} width={280} height={280} className="w-64 h-64 rounded-xl object-contain shadow-md" unoptimized />
          ) : (
            <div className="w-64 h-64 placeholder-tile text-6xl flex items-center justify-center rounded-xl">🧱</div>
          )}
          <div className="w-full flex flex-col gap-1 text-center">
            <h2 className="font-serif text-xl font-bold leading-snug">{result.title}</h2>
            <p className="subtitle text-sm">{result.creator}{result.year ? ` · ${result.year}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="text-xs px-2.5 py-1 rounded-full font-mono" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>
              #{setNum}
            </span>
            {result.num_parts != null && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, var(--bg-card))', color: 'var(--accent)' }}>
                🧱 {result.num_parts.toLocaleString()} pieces
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
