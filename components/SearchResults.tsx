'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import type { SearchResult, Track } from '@/lib/types'

interface VinylDetail {
  tracklist: Track[]
  sortName: string | null
}

interface DetailModalProps {
  result: SearchResult
  onClose: () => void
}

function VinylDetailModal({ result, onClose }: DetailModalProps) {
  const [detail, setDetail] = useState<VinylDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/vinyl/${result.external_id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setDetail(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [result.external_id])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div
        className="card w-full rounded-b-none flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-end p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="btn-ghost px-3 py-1 text-sm">✕ Close</button>
        </div>
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex gap-4">
            {result.cover_url ? (
              <Image src={result.cover_url} alt={result.title} width={100} height={100} className="w-24 h-24 rounded-lg object-cover flex-shrink-0 shadow" unoptimized />
            ) : (
              <div className="w-24 h-24 placeholder-tile flex-shrink-0 text-3xl flex items-center justify-center">🎵</div>
            )}
            <div className="flex flex-col gap-1 min-w-0">
              <h2 className="font-serif text-lg font-bold leading-snug">{result.title}</h2>
              <p className="subtitle text-sm">{result.creator}</p>
              {result.year && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{result.year}</p>}
            </div>
          </div>

          {/* Metadata pills */}
          <div className="flex flex-wrap gap-2">
            {result.format && <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{result.format}</span>}
            {result.label && <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{result.label}</span>}
            {result.country && <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{result.country}</span>}
            {result.catno && <span className="text-xs px-2.5 py-1 rounded-full font-mono" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{result.catno}</span>}
            {result.genres && result.genres.split(', ').map(g => (
              <span key={g} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, var(--bg-card))', color: 'var(--accent)' }}>{g}</span>
            ))}
            {result.styles && result.styles.split(', ').map(s => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text)' }}>{s}</span>
            ))}
          </div>

          {/* Tracklist — always rendered so the modal doesn't shift when data loads */}
          <div>
            <p className="label mb-2 block">Tracklist</p>
            {loading && (
              <div className="flex flex-col gap-2">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="w-8 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
                    <div className="flex-1 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--border)', width: `${55 + (i % 3) * 15}%` }} />
                  </div>
                ))}
              </div>
            )}
            {detail && detail.tracklist.length > 0 && (
              <ol className="flex flex-col gap-1">
                {detail.tracklist.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="subtitle w-8 flex-shrink-0">{t.position || i + 1}</span>
                    <span className="flex-1">{t.title}</span>
                    {t.duration && <span className="subtitle flex-shrink-0">{t.duration}</span>}
                  </li>
                ))}
              </ol>
            )}
            {detail && detail.tracklist.length === 0 && (
              <p className="subtitle text-sm">No tracklist available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  results: SearchResult[]
  onAdd: (result: SearchResult, isWishlist: boolean) => Promise<void>
  adding: string | null
  getDupeStatus?: (result: SearchResult) => 'owned' | 'wishlist' | null
}

export default function SearchResults({ results, onAdd, adding, getDupeStatus }: Props) {
  const [detailFor, setDetailFor] = useState<SearchResult | null>(null)

  if (results.length === 0) return <p className="subtitle text-center py-8">No results found.</p>

  return (
    <>
      <ul className="flex flex-col gap-3">
        {results.map(r => {
          const dupe = getDupeStatus?.(r) ?? null
          const isVinyl = r.source === 'discogs'
          return (
            <li key={r.external_id} className="card p-4 flex gap-4 items-start">
              <div className="flex-shrink-0">
                {r.cover_url ? (
                  <Image src={r.cover_url} alt={r.title} width={80} height={80} className="rounded object-cover w-20 h-20" unoptimized />
                ) : (
                  <div className="w-20 h-20 placeholder-tile flex-shrink-0 text-3xl flex items-center justify-center">📄</div>
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

      {detailFor && (
        <VinylDetailModal result={detailFor} onClose={() => setDetailFor(null)} />
      )}
    </>
  )
}
