import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMemberBySlug } from '@/lib/db/members'
import { listAllItems } from '@/lib/db/items'
import StatsView from '@/components/StatsView'

export default async function StatsPage({ params }: { params: Promise<{ member: string }> }) {
  const { member: slug } = await params
  const member = await getMemberBySlug(slug)
  if (!member) notFound()

  const items = await listAllItems(member.id)

  return (
    <main className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/${slug}/vinyl`} className="btn-ghost text-sm">← Collection</Link>
        <h1 className="font-serif text-xl font-bold">{member.name}&rsquo;s Stats</h1>
      </div>
      <StatsView items={items} />
    </main>
  )
}
