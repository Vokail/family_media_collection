/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, act } from '@testing-library/react'

jest.mock('@/components/ItemCard', () => ({
  __esModule: true,
  default: ({ item }: { item: { title: string } }) => <div data-testid="item-card">{item.title}</div>,
}))

import WishlistList from '@/components/WishlistList'
import type { Item } from '@/lib/types'

function makeItem(id: string, title: string): Item {
  return {
    id,
    title,
    member_id: 'm1',
    collection: 'vinyl',
    creator: 'Artist',
    year: null,
    cover_path: null,
    is_wishlist: true,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    external_id: null,
    sort_name: null,
    isbn: null,
    description: null,
    tracklist: null,
    rating: null,
    genres: null,
    styles: null,
    status: null,
    lego_status: null,
    locked_fields: null,
  }
}

const ITEM_A = makeItem('i1', 'Album A')
const ITEM_B = makeItem('i2', 'Album B')

// 65 items to exceed PAGE_SIZE (60)
const manyItems = Array.from({ length: 65 }, (_, i) => makeItem(`id${i}`, `Track ${i + 1}`))

let observerCallback: IntersectionObserverCallback
beforeEach(() => {
  window.IntersectionObserver = jest.fn((cb) => {
    observerCallback = cb
    return { observe: jest.fn(), disconnect: jest.fn() }
  }) as unknown as typeof IntersectionObserver
})

describe('WishlistList', () => {
  it('renders items from initialItems', () => {
    render(<WishlistList initialItems={[ITEM_A, ITEM_B]} isEditor={false} supabaseUrl="https://x.supabase.co" />)
    expect(screen.getByText('Album A')).toBeInTheDocument()
    expect(screen.getByText('Album B')).toBeInTheDocument()
  })

  it('returns null when initialItems is empty', () => {
    const { container } = render(<WishlistList initialItems={[]} isEditor={false} supabaseUrl="https://x.supabase.co" />)
    expect(container.firstChild).toBeNull()
  })

  it('syncs displayed items when initialItems prop changes (filter bug fix)', () => {
    // Simulates parent filtering: first renders both items, then re-renders with only one
    const { rerender } = render(
      <WishlistList initialItems={[ITEM_A, ITEM_B]} isEditor={false} supabaseUrl="https://x.supabase.co" />,
    )
    expect(screen.getByText('Album A')).toBeInTheDocument()
    expect(screen.getByText('Album B')).toBeInTheDocument()

    act(() => {
      rerender(
        <WishlistList initialItems={[ITEM_B]} isEditor={false} supabaseUrl="https://x.supabase.co" />,
      )
    })

    expect(screen.queryByText('Album A')).not.toBeInTheDocument()
    expect(screen.getByText('Album B')).toBeInTheDocument()
  })

  it('shows only the first 60 items initially', () => {
    render(<WishlistList initialItems={manyItems} isEditor={false} supabaseUrl="https://x.supabase.co" />)
    expect(screen.getAllByTestId('item-card')).toHaveLength(60)
  })

  it('renders a sentinel when there are more items', () => {
    render(<WishlistList initialItems={manyItems} isEditor={false} supabaseUrl="https://x.supabase.co" />)
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('loads more items when sentinel becomes visible', () => {
    render(<WishlistList initialItems={manyItems} isEditor={false} supabaseUrl="https://x.supabase.co" />)
    act(() => {
      observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(screen.getAllByTestId('item-card')).toHaveLength(65)
  })

  it('resets pagination when initialItems changes', () => {
    const { rerender } = render(
      <WishlistList initialItems={manyItems} isEditor={false} supabaseUrl="https://x.supabase.co" />,
    )
    act(() => {
      observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(screen.getAllByTestId('item-card')).toHaveLength(65)

    // Simulate filter change from parent — resets to first page
    act(() => {
      rerender(<WishlistList initialItems={manyItems.slice(0, 65)} isEditor={false} supabaseUrl="https://x.supabase.co" />)
    })
    expect(screen.getAllByTestId('item-card')).toHaveLength(60)
  })
})
