'use client'
import { useState } from 'react'
import type { Item, CollectionType } from '@/lib/types'

const COLLECTIONS: CollectionType[] = ['vinyl', 'book', 'comic', 'lego']
const COLLECTION_LABEL: Record<CollectionType, string> = {
  vinyl: 'Vinyl', book: 'Books', comic: 'Comics', lego: 'Lego',
}
const COLLECTION_EMOJI: Record<CollectionType, string> = {
  vinyl: '🎵', book: '📚', comic: '🦸', lego: '🧱',
}

function Bar({ count, max }: { count: number; max: number }) {
  return (
    <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${max > 0 ? (count / max) * 100 : 0}%`, backgroundColor: 'var(--accent)' }}
      />
    </div>
  )
}

export default function StatsView({ items }: { items: Item[] }) {
  const [col, setCol] = useState<CollectionType | 'all'>('all')

  const filtered = col === 'all' ? items : items.filter(i => i.collection === col)
  const owned = filtered.filter(i => !i.is_wishlist)
  const wishlist = filtered.filter(i => i.is_wishlist)
  const barMax = Math.max(owned.length, 1)

  const byCollection = COLLECTIONS.map(c => ({
    c,
    owned: items.filter(i => i.collection === c && !i.is_wishlist).length,
    wishlist: items.filter(i => i.collection === c && i.is_wishlist).length,
  })).filter(g => g.owned + g.wishlist > 0)

  const ratingCounts = [5, 4, 3, 2, 1].map(r => ({
    stars: r,
    count: owned.filter(i => i.rating === r).length,
  }))
  const ratedCount = owned.filter(i => i.rating != null).length

  const topRated = owned.filter(i => i.rating === 5).slice(0, 6)

  // Status breakdown — only for single-collection views
  const statusLabel: Record<string, string> = {
    vinyl: 'Listening status',
    book: 'Reading status',
    comic: 'Reading status',
    lego: 'Build status',
  }
  const consumedCount = owned.filter(i => i.status === 'consumed').length
  const notYetCount = owned.filter(i => i.status == null).length
  const legoBuilt = owned.filter(i => i.lego_status === 'built').length
  const legoInBox = owned.filter(i => i.lego_status === 'in_box').length
  const legoApart = owned.filter(i => i.lego_status === 'disassembled').length
  const statusActionLabel: Record<string, string> = {
    vinyl: 'Listened',
    book: 'Read',
    comic: 'Read',
  }

  const decadeMap = new Map<number, number>()
  for (const item of owned) {
    if (item.year) {
      const decade = Math.floor(item.year / 10) * 10
      decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1)
    }
  }
  const decades = Array.from(decadeMap.entries()).sort(([a], [b]) => a - b)

  return (
    <>
      {/* Collection tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b mb-6" style={{ borderColor: 'var(--border)' }}>
        {(['all', ...COLLECTIONS] as const).map(c => {
          const isActive = col === c
          return (
            <button
              key={c}
              onClick={() => setCol(c)}
              className="whitespace-nowrap px-4 py-2 text-sm font-semibold transition-colors flex-shrink-0"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {c === 'all' ? 'All' : COLLECTION_LABEL[c]}
            </button>
          )
        })}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-3xl font-serif font-bold" style={{ color: 'var(--accent)' }}>{owned.length}</p>
          <p className="label mt-1">Owned</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-serif font-bold" style={{ color: 'var(--text-muted)' }}>{wishlist.length}</p>
          <p className="label mt-1">Wishlist</p>
        </div>
      </div>

      {/* Status breakdown — only for single-collection views */}
      {col !== 'all' && owned.length > 0 && (
        <section className="card p-4 mb-4" data-testid="status-breakdown">
          <h2 className="label mb-3">{statusLabel[col]}</h2>
          {col === 'lego' ? (
            <div className="flex flex-col gap-2">
              {[
                { label: '🔨 Built', count: legoBuilt },
                { label: '📦 In box', count: legoInBox },
                { label: '🔧 Apart', count: legoApart },
              ].map(({ label, count }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs w-20 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <Bar count={count} max={owned.length} />
                  <span className="text-xs w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {[
                { label: statusActionLabel[col], count: consumedCount },
                { label: 'Not yet', count: notYetCount },
              ].map(({ label, count }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <Bar count={count} max={owned.length} />
                  <span className="text-xs w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Per collection — only shown on "All" tab */}
      {col === 'all' && (
        <section className="card p-4 mb-4">
          <h2 className="label mb-3">By collection</h2>
          <div className="flex flex-col gap-2">
            {byCollection.map(({ c, owned: o, wishlist: w }) => (
              <div key={c} className="flex items-center gap-3">
                <span className="text-lg w-6 text-center">{COLLECTION_EMOJI[c]}</span>
                <span className="flex-1 text-sm font-medium">{COLLECTION_LABEL[c]}</span>
                <span className="text-sm" style={{ color: 'var(--accent)' }}>{o} owned</span>
                {w > 0 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{w} wishlist</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rating distribution */}
      {ratedCount > 0 && (
        <section className="card p-4 mb-4">
          <h2 className="label mb-3">Ratings ({ratedCount} rated)</h2>
          <div className="flex flex-col gap-2">
            {ratingCounts.map(({ stars, count }) => (
              <div key={stars} className="flex items-center gap-2">
                <span className="text-xs w-16 text-right flex-shrink-0 tracking-tight" style={{ color: 'var(--accent)' }}>{'★'.repeat(stars)}</span>
                <Bar count={count} max={barMax} />
                <span className="text-xs w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top rated */}
      {topRated.length > 0 && (
        <section className="card p-4 mb-4">
          <h2 className="label mb-3">★★★★★ Favourites</h2>
          <ul className="flex flex-col gap-1">
            {topRated.map(item => (
              <li key={item.id} className="flex gap-2 text-sm items-center">
                <span className="text-base">{COLLECTION_EMOJI[item.collection]}</span>
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{item.creator}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Decades */}
      {decades.length > 0 && (
        <section className="card p-4 mb-4">
          <h2 className="label mb-3">By decade</h2>
          <div className="flex flex-col gap-2">
            {decades.map(([decade, count]) => (
              <div key={decade} className="flex items-center gap-2">
                <span className="text-xs w-10 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{decade}s</span>
                <Bar count={count} max={barMax} />
                <span className="text-xs w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {owned.length === 0 && (
        <p className="subtitle text-center py-8">No owned items in this collection yet.</p>
      )}
    </>
  )
}
