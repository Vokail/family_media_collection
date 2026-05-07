/**
 * @jest-environment jsdom
 *
 * Battery / bandwidth regression: ItemCard's cover Images must carry a `sizes`
 * hint so the browser fetches a small srcset variant for tile-sized covers.
 * Without this, a 540px image is loaded for a 48px or 200px tile — wasted
 * bandwidth + extra image-decode work on iOS.
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render } from '@testing-library/react'

// next/image renders a real <img> in jsdom; we assert against its attributes
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // Forward sizes/loading/decoding so they're observable in the rendered HTML
    const { src, alt, sizes, loading, decoding, width, height } = props as {
      src: string; alt: string; sizes?: string; loading?: string; decoding?: string;
      width?: number; height?: number
    }
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img src={src} alt={alt} sizes={sizes} loading={loading} decoding={decoding} width={width} height={height} />
  },
}))

jest.mock('@/components/Toast', () => ({
  useToast: () => ({ show: jest.fn() }),
}))

import ItemCard from '@/components/ItemCard'
import type { Item } from '@/lib/types'

const baseItem: Item = {
  id: 'i-1',
  member_id: 'm-1',
  collection: 'vinyl',
  title: 'Abbey Road',
  creator: 'The Beatles',
  year: 1969,
  cover_path: 'covers/m-1/abbey.jpg',
  is_wishlist: false,
  notes: null,
  external_id: null,
  isbn: null,
  sort_name: null,
  rating: null,
  description: null,
  tracklist: null,
  status: null,
  genres: null,
  styles: null,
  condition: null,
  lego_status: null,
  locked_fields: null,
  created_at: new Date().toISOString(),
}

const noop = () => {}

describe('ItemCard cover image sizes hint (battery)', () => {
  it('grid view sets a responsive sizes hint, not the full-size default', () => {
    const { container } = render(
      <ItemCard item={baseItem} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://example.com" layout="grid" />
    )
    const img = container.querySelector('img[alt="Abbey Road"]')
    expect(img).not.toBeNull()
    const sizes = img!.getAttribute('sizes')
    expect(sizes).toBeTruthy()
    // The hint must reference a small fixed size on tablet+, not the default
    // (without `sizes` next/image generates a 100vw srcset which is too big)
    expect(sizes).toMatch(/200px/)
  })

  it('list view requests an exact 48px thumbnail', () => {
    const { container } = render(
      <ItemCard item={baseItem} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://example.com" layout="list" />
    )
    const img = container.querySelector('img[alt="Abbey Road"]')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('sizes')).toBe('48px')
  })
})
