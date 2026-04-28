export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { listWishlistItems } from '@/lib/db/items'
import { listMembers } from '@/lib/db/members'
import { getSession } from '@/lib/session'
import PullToRefresh from '@/components/PullToRefresh'
import WishlistList from '@/components/WishlistList'

export default async function WishlistPage() {
  const [members, allItems, session] = await Promise.all([
    listMembers(),
    listWishlistItems(),
    getSession(),
  ])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const isEditor = session.role === 'editor' || session.role === 'member'

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
          <WishlistList
            initialItems={items}
            isEditor={isEditor}
            supabaseUrl={supabaseUrl}
          />
        </section>
      ))}
    </main>
    </PullToRefresh>
  )
}
