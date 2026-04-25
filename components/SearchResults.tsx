'use client'
import Image from 'next/image'
import type { SearchResult } from '@/lib/types'

interface Props {
  results: SearchResult[]
  onAdd: (result: SearchResult, isWishlist: boolean) => Promise<void>
  adding: string | null
}

export default function SearchResults({ results, onAdd, adding }: Props) {
  if (results.length === 0) return <p className="subtitle text-center py-8">No results found.</p>

  return (
    <ul className="flex flex-col gap-3">
      {results.map(r => (
        <li key={r.external_id} className="card p-3 flex gap-3 items-center">
          {r.cover_url ? (
            <Image src={r.cover_url} alt={r.title} width={56} height={56} className="rounded object-cover flex-shrink-0 w-14 h-14" unoptimized />
          ) : (
            <div className="w-14 h-14 placeholder-tile flex-shrink-0 text-xl flex items-center justify-center">📄</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{r.title}</p>
            <p className="subtitle text-sm truncate">{r.creator}{r.year ? ` · ${r.year}` : ''}</p>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={() => onAdd(r, false)}
              disabled={adding === r.external_id}
              className="btn-primary text-xs px-3 py-1"
            >
              {adding === r.external_id ? '…' : 'Add'}
            </button>
            <button
              onClick={() => onAdd(r, true)}
              disabled={adding === r.external_id}
              className="btn-ghost text-xs px-3 py-1"
            >
              Wishlist
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
