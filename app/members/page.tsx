export const dynamic = 'force-dynamic'

import { listMembers, listMemberItemCounts } from '@/lib/db/members'
import MemberCard from '@/components/MemberCard'
import LogoutButton from '@/components/LogoutButton'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import PullToRefresh from '@/components/PullToRefresh'

export default async function MembersPage() {
  const [members, memberCounts, session] = await Promise.all([
    listMembers(),
    listMemberItemCounts(),
    getSession(),
  ])
  const isEditor = session.role === 'editor'
  const isMember = session.role === 'member'

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
          {isMember && (
            <Link href="/profile" className="btn-ghost text-xs">My PIN</Link>
          )}
          <LogoutButton />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {members.map(m => <MemberCard key={m.id} member={m} counts={memberCounts[m.id]} />)}
      </div>
    </main>
    </PullToRefresh>
  )
}
