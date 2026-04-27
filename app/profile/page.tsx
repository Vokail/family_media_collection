export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getMemberById } from '@/lib/db/members'
import ProfilePinForm from '@/components/ProfilePinForm'
import Link from 'next/link'

export default async function ProfilePage() {
  const session = await getSession()

  // Only member role has a profile page; editors use /settings, viewers can't set a PIN
  if (session.role !== 'member' || !session.editableMemberId) {
    redirect('/members')
  }

  const member = await getMemberById(session.editableMemberId)
  if (!member) redirect('/members')

  return (
    <main className="min-h-screen p-6 max-w-sm mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/members" className="btn-ghost text-sm">← Back</Link>
        <h1 className="font-serif text-2xl font-bold">My Profile</h1>
      </div>
      <ProfilePinForm memberId={member.id} memberName={member.name} />
    </main>
  )
}
