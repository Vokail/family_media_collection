export const dynamic = 'force-dynamic'

import { listMembers, listMemberItemCounts } from '@/lib/db/members'
import { listRecentActivity } from '@/lib/db/items'
import MemberCard from '@/components/MemberCard'
import LogoutButton from '@/components/LogoutButton'
import ActivityFeed from '@/components/ActivityFeed'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import PullToRefresh from '@/components/PullToRefresh'

export default async function MembersPage() {
  const [members, memberCounts, activity, session] = await Promise.all([
    listMembers(),
    listMemberItemCounts(),
    listRecentActivity(15),
    getSession(),
  ])
  const isEditor = session.role === 'editor'

  return (
    <PullToRefresh>
    <main className="min-h-screen p-6 max-w-sm mx-auto">
      <div className="flex flex-col gap-3 mb-8">
        <h1 className="text-2xl font-serif font-bold">Our Collection</h1>
        <div className="flex gap-2 flex-wrap">
          <Link href="/wishlist" className="btn-ghost text-xs">Wishlist</Link>
          {isEditor && (
            <Link href="/settings" className="btn-ghost text-xs">Settings</Link>
          )}
          <LogoutButton />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {members.map(m => <MemberCard key={m.id} member={m} counts={memberCounts[m.id]} supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!} />)}
      </div>
      <ActivityFeed items={activity} supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!} />
    </main>
    </PullToRefresh>
  )
}
