import Image from 'next/image'
import Link from 'next/link'
import type { ActivityItem } from '@/lib/types'
import { relativeTime } from '@/lib/utils'

const EMOJI: Record<string, string> = {
  vinyl: '🎵',
  book: '📚',
  comic: '🦸',
  lego: '🧱',
}

interface Props {
  items: ActivityItem[]
  supabaseUrl: string
}

export default function ActivityFeed({ items, supabaseUrl }: Props) {
  if (!items.length) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-lg font-semibold">Recently added</h2>
      <div className="flex flex-col">
        {items.map(item => {
          const coverSrc = item.cover_path
            ? `${supabaseUrl}/storage/v1/object/public/${item.cover_path}`
            : null
          return (
            <Link
              key={item.id}
              href={`/${item.member_slug}/${item.collection}`}
              className="flex items-center gap-3 py-2.5 hover:opacity-80 transition-opacity"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                className="relative w-10 h-10 flex-shrink-0 rounded overflow-hidden"
                style={{ backgroundColor: 'var(--border)' }}
              >
                {coverSrc ? (
                  <Image
                    src={coverSrc}
                    alt={item.title}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base">
                    {EMOJI[item.collection] ?? '📦'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{item.title}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {item.member_name} · {relativeTime(item.created_at)}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
