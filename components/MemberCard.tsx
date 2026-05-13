import Link from 'next/link'
import type { Member, CollectionType } from '@/lib/types'
import type { MemberItemCounts } from '@/lib/db/members'

const COLLECTION_ORDER: CollectionType[] = ['vinyl', 'book', 'comic', 'lego']
const COLLECTION_EMOJI: Record<string, string> = { vinyl: '🎵', book: '📚', comic: '🦸', lego: '🧱' }

export default function MemberCard({ member, counts, supabaseUrl }: { member: Member; counts?: MemberItemCounts; supabaseUrl?: string }) {
  const initial = member.name[0].toUpperCase()
  const enabled = member.enabled_collections ?? COLLECTION_ORDER
  const firstCollection = COLLECTION_ORDER.find(c => enabled.includes(c)) ?? 'vinyl'
  const countEntries = enabled.map(c => [c, counts?.[c] ?? 0] as [string, number])
  const avatarUrl = member.avatar_path && supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/${member.avatar_path}`
    : null

  return (
    // prefetch={false}: prevents background SSR + Supabase queries for every member card
    // on the /members page. Each prefetch would trigger listItems() server-side. The user
    // only visits one member at a time, so prefetching all 4 is pure waste on mobile/PWA.
    <Link href={`/${member.slug}/${firstCollection}`} prefetch={false}>
      <div className="card p-6 flex flex-col items-center gap-3 hover:scale-105 transition-transform cursor-pointer">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={member.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-serif font-bold text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {initial}
          </div>
        )}
        <span className="font-serif font-semibold text-lg">{member.name}</span>
        {/* Each badge is a stacked column: icon on top, count below (#148).
            All badges are the same height regardless of count, so 1-badge and
            4-badge cards are always equal in size. */}
        <div className="flex flex-wrap gap-3 justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
          {countEntries.map(([col, n]) => (
            <span key={col} className="flex flex-col items-center gap-0.5">
              <span>{COLLECTION_EMOJI[col]}</span>
              <span>{n}</span>
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
