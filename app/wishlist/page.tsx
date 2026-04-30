export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { listWishlistItems } from '@/lib/db/items'
import { listMembers } from '@/lib/db/members'
import { getSession } from '@/lib/session'
import PullToRefresh from '@/components/PullToRefresh'
import WishlistFilter from '@/components/WishlistFilter'

export default async function WishlistPage() {
  const [members, allItems, session] = await Promise.all([
    listMembers(),
    listWishlistItems(),
    getSession(),
  ])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const isEditor = session.role === 'editor' || session.role === 'member'

  return (
    <PullToRefresh>
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/members" className="btn-ghost text-sm">← Members</Link>
        <h1 className="font-serif text-2xl font-bold flex-1">Family Wishlist</h1>
        <span className="subtitle text-sm">{allItems.length} item{allItems.length !== 1 ? 's' : ''}</span>
      </div>

      <WishlistFilter
        members={members}
        initialItems={allItems}
        isEditor={isEditor}
        supabaseUrl={supabaseUrl}
      />
    </main>
    </PullToRefresh>
  )
}
