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
        <li key={r.external_id} className="card p-4 flex gap-4 items-center">
          {r.cover_url ? (
            <Image src={r.cover_url} alt={r.title} width={80} height={80} className="rounded object-cover flex-shrink-0 w-20 h-20" unoptimized />
          ) : (
            <div className="w-20 h-20 placeholder-tile flex-shrink-0 text-3xl flex items-center justify-center">📄</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-snug">{r.title}</p>
            <p className="subtitle text-sm truncate mt-0.5">{r.creator}{r.year ? ` · ${r.year}` : ''}</p>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => onAdd(r, false)}
              disabled={adding === r.external_id}
              className="btn-primary text-sm px-4 py-2"
            >
              {adding === r.external_id ? '…' : 'Add'}
            </button>
            <button
              onClick={() => onAdd(r, true)}
              disabled={adding === r.external_id}
              className="btn-ghost text-sm px-4 py-2"
            >
              Wishlist
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
