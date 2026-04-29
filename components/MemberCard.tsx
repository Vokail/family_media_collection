import Link from 'next/link'
import type { Member, CollectionType } from '@/lib/types'
import type { MemberItemCounts } from '@/lib/db/members'

const COLLECTION_ORDER: CollectionType[] = ['vinyl', 'book', 'comic', 'lego']
const COLLECTION_EMOJI: Record<string, string> = { vinyl: '🎵', book: '📚', comic: '🦸', lego: '🧱' }

export default function MemberCard({ member, counts }: { member: Member; counts?: MemberItemCounts }) {
  const initial = member.name[0].toUpperCase()
  const enabled = member.enabled_collections ?? COLLECTION_ORDER
  const firstCollection = COLLECTION_ORDER.find(c => enabled.includes(c)) ?? 'vinyl'
  const countEntries = enabled.map(c => [c, counts?.[c] ?? 0] as [string, number])

  return (
    <Link href={`/${member.slug}/${firstCollection}`}>
      <div className="card p-6 flex flex-col items-center gap-3 hover:scale-105 transition-transform cursor-pointer">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-serif font-bold text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {initial}
        </div>
        <span className="font-serif font-semibold text-lg">{member.name}</span>
        <div className="flex gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {countEntries.map(([col, n]) => (
            <span key={col}>{COLLECTION_EMOJI[col]} {n}</span>
          ))}
        </div>
      </div>
    </Link>
  )
}
