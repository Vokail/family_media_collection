import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMemberBySlug } from '@/lib/db/members'
import { listAllItems } from '@/lib/db/items'
import type { CollectionType } from '@/lib/types'

const COLLECTIONS: CollectionType[] = ['vinyl', 'book', 'comic', 'lego']
const COLLECTION_LABEL: Record<CollectionType, string> = {
  vinyl: 'Vinyl', book: 'Books', comic: 'Comics', lego: 'Lego',
}
const COLLECTION_EMOJI: Record<CollectionType, string> = {
  vinyl: '🎵', book: '📚', comic: '🦸', lego: '🧱',
}

export default async function StatsPage({ params }: { params: Promise<{ member: string }> }) {
  const { member: slug } = await params
  const member = await getMemberBySlug(slug)
  if (!member) notFound()

  const items = await listAllItems(member.id)
  const owned = items.filter(i => !i.is_wishlist)
  const wishlist = items.filter(i => i.is_wishlist)

  const byCollection = COLLECTIONS.map(col => ({
    col,
    owned: owned.filter(i => i.collection === col).length,
    wishlist: wishlist.filter(i => i.collection === col).length,
  })).filter(g => g.owned + g.wishlist > 0)

  // Rating distribution
  const ratingCounts = [5, 4, 3, 2, 1].map(r => ({
    stars: r,
    count: owned.filter(i => i.rating === r).length,
  }))
  const ratedCount = owned.filter(i => i.rating != null).length
  const maxRatingCount = Math.max(...ratingCounts.map(r => r.count), 1)

  // Top rated (5 stars, newest first)
  const topRated = owned.filter(i => i.rating === 5).slice(0, 6)

  // Decade breakdown (owned only, items with a year)
  const decadeMap = new Map<number, number>()
  for (const item of owned) {
    if (item.year) {
      const decade = Math.floor(item.year / 10) * 10
      decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1)
    }
  }
  const decades = Array.from(decadeMap.entries()).sort(([a], [b]) => a - b)
  const maxDecadeCount = Math.max(...decades.map(([, c]) => c), 1)

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${slug}/vinyl`} className="btn-ghost text-sm">← Collection</Link>
        <h1 className="font-serif text-xl font-bold">{member.name}&rsquo;s Stats</h1>
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

      {/* Per collection */}
      <section className="card p-4 mb-4">
        <h2 className="label mb-3">By collection</h2>
        <div className="flex flex-col gap-2">
          {byCollection.map(({ col, owned: o, wishlist: w }) => (
            <div key={col} className="flex items-center gap-3">
              <span className="text-lg w-6 text-center">{COLLECTION_EMOJI[col]}</span>
              <span className="flex-1 text-sm font-medium">{COLLECTION_LABEL[col]}</span>
              <span className="text-sm" style={{ color: 'var(--accent)' }}>{o} owned</span>
              {w > 0 && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{w} wishlist</span>}
            </div>
          ))}
        </div>
      </section>

      {/* Rating distribution */}
      {ratedCount > 0 && (
        <section className="card p-4 mb-4">
          <h2 className="label mb-3">Ratings ({ratedCount} rated)</h2>
          <div className="flex flex-col gap-2">
            {ratingCounts.map(({ stars, count }) => (
              <div key={stars} className="flex items-center gap-2">
                <span className="text-xs w-16 text-right flex-shrink-0 tracking-tight" style={{ color: 'var(--accent)' }}>{'★'.repeat(stars)}</span>
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(count / maxRatingCount) * 100}%`, backgroundColor: 'var(--accent)' }}
                  />
                </div>
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
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(count / maxDecadeCount) * 100}%`, backgroundColor: 'var(--accent)' }}
                  />
                </div>
                <span className="text-xs w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
