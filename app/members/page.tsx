import { listMembers } from '@/lib/db/members'
import MemberCard from '@/components/MemberCard'
import LogoutButton from '@/components/LogoutButton'
import Link from 'next/link'
import { getSession } from '@/lib/session'

export default async function MembersPage() {
  const members = await listMembers()
  const session = await getSession()
  const isEditor = session.role === 'editor'

  return (
    <main className="min-h-screen p-6 max-w-sm mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-serif font-bold">Our Collection</h1>
        <div className="flex gap-2">
          {isEditor && (
            <Link href="/settings" className="btn-ghost text-xs">Settings</Link>
          )}
          <LogoutButton />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {members.map(m => <MemberCard key={m.id} member={m} />)}
      </div>
    </main>
  )
}
