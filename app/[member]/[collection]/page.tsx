import { notFound, redirect } from 'next/navigation'
import { getMemberBySlug } from '@/lib/db/members'
import { listItems } from '@/lib/db/items'
import { getSession } from '@/lib/session'
import CollectionGrid from '@/components/CollectionGrid'
import Link from 'next/link'
import type { CollectionType } from '@/lib/types'

const VALID_COLLECTIONS: CollectionType[] = ['vinyl', 'book', 'comic', 'lego']

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ member: string; collection: string }>
}) {
  const { member: slug, collection } = await params
  if (!VALID_COLLECTIONS.includes(collection as CollectionType)) notFound()

  const [member, session] = await Promise.all([getMemberBySlug(slug), getSession()])
  if (!member) notFound()

  const enabledCollections = member.enabled_collections ?? VALID_COLLECTIONS

  // Redirect to first enabled collection if current one is disabled
  if (!enabledCollections.includes(collection as CollectionType)) {
    redirect(`/${slug}/${enabledCollections[0]}`)
  }

  const items = await listItems(member.id, collection as CollectionType)
  const isOwnProfile = session.role === 'member' && session.editableMemberId === member.id

  return (
    <main className="min-h-screen p-4 max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/members" className="btn-ghost text-sm">← Members</Link>
        <h1 className="font-serif text-xl font-bold flex-1">{member.name}</h1>
        <Link href={`/${slug}/stats?from=${collection}`} className="btn-ghost text-xs">Stats</Link>
        {isOwnProfile && (
          <Link href="/profile" className="btn-ghost text-xs" title="My profile">👤</Link>
        )}
      </div>
      <CollectionGrid
        member={member}
        collection={collection as CollectionType}
        initialItems={items}
        isEditor={session.role === 'editor' || isOwnProfile}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
        enabledCollections={enabledCollections}
      />
    </main>
  )
}
