import Link from 'next/link'
import type { Member } from '@/lib/types'

export default function MemberCard({ member }: { member: Member }) {
  const initial = member.name[0].toUpperCase()
  return (
    <Link href={`/${member.slug}/vinyl`}>
      <div className="card p-6 flex flex-col items-center gap-3 hover:scale-105 transition-transform cursor-pointer">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-serif font-bold text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {initial}
        </div>
        <span className="font-serif font-semibold text-lg">{member.name}</span>
      </div>
    </Link>
  )
}
