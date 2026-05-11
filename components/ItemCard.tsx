'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import type { Item } from '@/lib/types'
import { isNew } from '@/lib/utils'
import { CONDITION_OPTIONS } from '@/lib/conditions'
import ItemDetailSheet from './ItemDetailSheet'

interface Props {
  item: Item
  isEditor: boolean
  onUpdate: (updated: Item) => void
  onDelete: (id: string) => void
  supabaseUrl: string
  layout?: 'grid' | 'list'
  initialOpen?: boolean
  forceOpen?: boolean
  onForceClose?: () => void
}

export default function ItemCard({ item, isEditor, onUpdate, onDelete, supabaseUrl, layout = 'grid', initialOpen = false, forceOpen, onForceClose }: Props) {
  const [open, setOpen] = useState(initialOpen)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  function closeSheet() {
    setOpen(false)
    onForceClose?.()
  }

  const coverSrc = item.cover_path
    ? `${supabaseUrl}/storage/v1/object/public/${item.cover_path}`
    : null
  const showNewBadge = item.created_at ? isNew(item.created_at) : false
  const consumed = item.status === 'consumed'
  const conditionOption = CONDITION_OPTIONS.find(o => o.value === item.condition) ?? null
  const legoStatusLabel = item.lego_status === 'built' ? '🔨 Built'
    : item.lego_status === 'in_box' ? '📦 In box'
    : item.lego_status === 'disassembled' ? '🔧 Apart'
    : null
  const emoji = item.collection === 'vinyl' ? '🎵' : item.collection === 'book' ? '📚' : item.collection === 'lego' ? '🧱' : '🦸'

  return (
    <>
      {layout === 'list' ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:opacity-80 transition-opacity"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden shadow" style={{ backgroundColor: 'var(--border)' }}>
            {coverSrc ? (
              // sizes="48px" tells the browser this is a tiny thumbnail — picks
              // the smallest srcset variant instead of fetching a full-size cover.
              // Saves both bandwidth and image-decode CPU/battery on iOS.
              <Image src={coverSrc} alt={item.title} width={48} height={48} sizes="48px" className="w-full h-full object-cover" />
            ) : (
              <div className="placeholder-tile w-full h-full text-lg" style={{ color: 'var(--text-muted)' }}>{emoji}</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{item.title}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{item.creator}{item.year ? ` · ${item.year}` : ''}</p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            {showNewBadge && (
              <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold leading-none" style={{ backgroundColor: 'var(--accent)' }}>NEW</span>
            )}
            {consumed && item.collection === 'vinyl' && (
              <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>✓</span>
            )}
            {consumed && (item.collection === 'book' || item.collection === 'comic') && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white leading-none" style={{ backgroundColor: 'var(--accent)' }}>Read</span>
            )}
            {item.rating && (
              <span className="text-xs" style={{ color: 'var(--accent)' }}>{'★'.repeat(item.rating)}</span>
            )}
            {item.collection === 'lego' && legoStatusLabel && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{legoStatusLabel}</span>
            )}
            {item.collection === 'vinyl' && conditionOption && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: conditionOption.color }}>{conditionOption.abbr}</span>
            )}
          </div>
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full aspect-square relative" aria-label={`Open details for ${item.title}`}>
          {coverSrc ? (
            <div className="relative w-full h-full rounded-lg overflow-hidden shadow-md" style={{ backgroundColor: 'var(--border)' }}>
              <Image
                src={coverSrc}
                alt={item.title}
                width={200}
                height={200}
                // Grid is 2 cols on phones up to 6 on xl. The 200px hint matches
                // the sm+ tile size; on smaller phones we use 50vw which lands on
                // the 640px srcset variant — still way smaller than the full cover.
                sizes="(min-width: 768px) 200px, 50vw"
                className={`w-full h-full ${item.collection === 'lego' ? 'object-contain p-1' : 'object-cover'}`}
              />
            </div>
          ) : (
            <div className="placeholder-tile w-full h-full flex-col gap-1 px-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <span className="text-2xl">{emoji}</span>
              <p className="text-xs font-semibold leading-tight text-center line-clamp-3 w-full" style={{ color: 'var(--text)' }}>{item.title}</p>
              {item.creator && <p className="text-[10px] leading-tight text-center line-clamp-2 w-full">{item.creator}</p>}
            </div>
          )}
          {item.rating && (
            <>
              <div className="absolute bottom-0 left-0 right-0 h-8 rounded-b-lg pointer-events-none" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.55))' }} />
              <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <span key={s} className="text-xs leading-none drop-shadow" style={{ color: s <= item.rating! ? '#f5a623' : 'rgba(255,255,255,0.4)' }}>★</span>
                ))}
              </div>
            </>
          )}
          {showNewBadge && (
            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-white text-[10px] font-bold leading-none" style={{ backgroundColor: 'var(--accent)' }}>
              NEW
            </div>
          )}
          {consumed && item.collection === 'vinyl' && (
            <div className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow" style={{ backgroundColor: 'var(--accent)' }}>
              ✓
            </div>
          )}
          {consumed && (item.collection === 'book' || item.collection === 'comic') && (
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-white text-[9px] font-bold leading-none shadow" style={{ backgroundColor: 'var(--accent)' }}>
              Read
            </div>
          )}
          {item.collection === 'lego' && legoStatusLabel && (
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-white text-[9px] font-bold leading-none shadow"
              style={{ backgroundColor: item.lego_status === 'built' ? 'var(--accent)' : 'rgba(44,26,14,0.65)' }}>
              {legoStatusLabel}
            </div>
          )}
          {item.collection === 'vinyl' && conditionOption && (
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-white text-[9px] font-bold leading-none shadow"
              style={{ backgroundColor: conditionOption.color }}>
              {conditionOption.abbr}
            </div>
          )}
        </button>
      )}

      {open && (
        <ItemDetailSheet
          item={item}
          isEditor={isEditor}
          onUpdate={onUpdate}
          onDelete={onDelete}
          supabaseUrl={supabaseUrl}
          onClose={closeSheet}
        />
      )}
    </>
  )
}
