export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getMemberById } from '@/lib/db/members'
import ProfilePinForm from '@/components/ProfilePinForm'
import AppVersion from '@/components/AppVersion'
import BackButton from '@/components/BackButton'
import LogoutButton from '@/components/LogoutButton'

export default async function ProfilePage() {
  const session = await getSession()

  if (session.role !== 'member' || !session.editableMemberId) {
    redirect('/members')
  }

  const member = await getMemberById(session.editableMemberId)
  if (!member) redirect('/members')

  return (
    <main className="min-h-screen p-6 max-w-sm mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="font-serif text-2xl font-bold flex-1">My Profile</h1>
        <LogoutButton />
      </div>
      <ProfilePinForm
        memberId={member.id}
        memberName={member.name}
        enabledCollections={member.enabled_collections ?? ['vinyl', 'book', 'comic', 'lego']}
      />
      <AppVersion />
    </main>
  )
}
