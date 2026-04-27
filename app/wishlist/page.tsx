export const dynamic = 'force-dynamic'

import Link from 'next/link'
import Image from 'next/image'
import { listWishlistItems } from '@/lib/db/items'
import { listMembers } from '@/lib/db/members'
import type { CollectionType } from '@/lib/types'
import PullToRefresh from '@/components/PullToRefresh'

const COLLECTION_EMOJI: Record<CollectionType, string> = {
  vinyl: '🎵', book: '📚', comic: '🦸', lego: '🧱',
}

export default async function WishlistPage() {
  const [members, allItems] = await Promise.all([
    listMembers(),
    listWishlistItems(),
  ])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const byMember = members.map(m => ({
    member: m,
    items: allItems.filter(i => i.member_id === m.id),
  })).filter(g => g.items.length > 0)

  const totalCount = allItems.length

  return (
    <PullToRefresh>
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/members" className="btn-ghost text-sm">← Members</Link>
        <h1 className="font-serif text-2xl font-bold flex-1">Family Wishlist</h1>
        <span className="subtitle text-sm">{totalCount} item{totalCount !== 1 ? 's' : ''}</span>
      </div>

      {byMember.length === 0 && (
        <p className="subtitle text-center py-16">No wishlist items yet.</p>
      )}

      {byMember.map(({ member, items }) => (
        <section key={member.id} className="mb-8">
          <h2 className="font-serif text-lg font-bold mb-3 flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {member.name[0]}
            </span>
            {member.name}
            <span className="subtitle text-sm font-normal">({items.length})</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {items.map(item => {
              const coverSrc = item.cover_path
                ? `${supabaseUrl}/storage/v1/object/public/${item.cover_path}`
                : null
              return (
                <li key={item.id} className="card p-3 flex gap-3 items-center">
                  {coverSrc ? (
                    <Image src={coverSrc} alt={item.title} width={48} height={48} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 placeholder-tile flex-shrink-0 text-xl flex items-center justify-center">
                      {COLLECTION_EMOJI[item.collection]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-snug truncate">{item.title}</p>
                    <p className="subtitle text-xs truncate">{item.creator}{item.year ? ` · ${item.year}` : ''}</p>
                  </div>
                  <Link
                    href={`/${member.slug}/${item.collection}`}
                    className="text-xs flex-shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {COLLECTION_EMOJI[item.collection]}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </main>
    </PullToRefresh>
  )
}
