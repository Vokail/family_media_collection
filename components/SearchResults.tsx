'use client'
import Image from 'next/image'
import { useState } from 'react'
import type { SearchResult } from '@/lib/types'
import VinylDetailModal from './VinylDetailModal'
import LegoDetailModal from './LegoDetailModal'

interface Props {
  results: SearchResult[]
  hasSearched?: boolean
  onAdd: (result: SearchResult, isWishlist: boolean) => Promise<void>
  adding: string | null
  getDupeStatus?: (result: SearchResult) => 'owned' | 'wishlist' | null
}

export default function SearchResults({ results, hasSearched, onAdd, adding, getDupeStatus }: Props) {
  const [detailFor, setDetailFor] = useState<SearchResult | null>(null)

  if (results.length === 0) {
    if (!hasSearched) return null
    return <p className="subtitle text-center py-8">No results found.</p>
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {results.map(r => {
          const dupe = getDupeStatus?.(r) ?? null
          const isVinyl = r.source === 'discogs'
          const isLego = r.source === 'rebrickable'
          return (
            <li key={r.external_id} className={`card p-4 flex gap-4 items-start${isLego ? ' items-center' : ''}`}>
              <div className="flex-shrink-0">
                {r.cover_url ? (
                  <Image src={r.cover_url} alt={r.title} width={isLego ? 112 : 80} height={isLego ? 112 : 80} className={`rounded object-contain${isLego ? ' w-28 h-28' : ' w-20 h-20 object-cover'}`} unoptimized />
                ) : (
                  <div className={`placeholder-tile flex-shrink-0 text-3xl flex items-center justify-center${isLego ? ' w-28 h-28' : ' w-20 h-20'}`}>
                    {isLego ? '🧱' : '📄'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base leading-snug">{r.title}</p>
                <p className="subtitle text-sm mt-0.5">{r.creator}{r.year ? ` · ${r.year}` : ''}</p>
                {/* Vinyl extras */}
                {isVinyl && (r.format || r.label || r.country) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.format && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{r.format}</span>}
                    {r.label && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{r.label}</span>}
                    {r.country && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{r.country}</span>}
                    {r.catno && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{r.catno}</span>}
                  </div>
                )}
                {dupe && (
                  <span
                    className="inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: dupe === 'owned' ? 'var(--accent)' : 'var(--border)',
                      color: dupe === 'owned' ? 'white' : 'var(--text-muted)',
                    }}
                  >
                    {dupe === 'owned' ? '✓ In collection' : '★ On wishlist'}
                  </span>
                )}
                {isVinyl && (
                  <button
                    onClick={() => setDetailFor(r)}
                    className="mt-1.5 text-xs underline block"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Details & tracklist
                  </button>
                )}
                {isLego && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>
                      #{r.external_id}
                    </span>
                    {r.num_parts != null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        🧱 {r.num_parts.toLocaleString()}
                      </span>
                    )}
                    <button
                      onClick={() => setDetailFor(r)}
                      className="text-xs underline"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Details
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => onAdd(r, false)}
                  disabled={adding === r.external_id || dupe === 'owned'}
                  className="btn-primary text-sm px-4 py-2 disabled:opacity-40"
                >
                  {adding === r.external_id ? '…' : 'Add'}
                </button>
                <button
                  onClick={() => onAdd(r, true)}
                  disabled={adding === r.external_id || dupe === 'wishlist'}
                  className="btn-ghost text-sm px-4 py-2 disabled:opacity-40"
                >
                  Wishlist
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {detailFor && detailFor.source === 'discogs' && (
        <VinylDetailModal result={detailFor} onClose={() => setDetailFor(null)} />
      )}
      {detailFor && detailFor.source === 'rebrickable' && (
        <LegoDetailModal result={detailFor} onClose={() => setDetailFor(null)} />
      )}
    </>
  )
}
