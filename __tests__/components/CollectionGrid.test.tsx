/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
jest.mock('next/image', () => ({ __esModule: true, default: ({ alt }: { alt: string }) => <img alt={alt} /> }))
jest.mock('@/components/ItemCard', () => ({
  __esModule: true,
  default: ({ item, layout }: { item: { id: string; title: string }; layout?: string }) => (
    <div data-testid="item-card" data-layout={layout ?? 'grid'}>{item.title}</div>
  ),
}))
jest.mock('@/components/Toast', () => ({
  __esModule: true,
  useToast: () => ({ show: jest.fn() }),
}))

import CollectionGrid from '@/components/CollectionGrid'

const MEMBER = { id: 'uuid-1', name: 'Alice', slug: 'alice' }

const makeItem = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  id,
  member_id: 'uuid-1',
  collection: 'vinyl' as const,
  title: `Album ${id}`,
  creator: 'Artist',
  year: 2020,
  cover_path: null,
  is_wishlist: false,
  notes: null,
  created_at: new Date().toISOString(),
  external_id: null,
  isbn: null,
  sort_name: null,
  rating: null,
  description: null,
  tracklist: null,
  status: null,
  genres: null,
  styles: null,
  ...overrides,
})

const defaultProps = {
  member: MEMBER,
  collection: 'vinyl' as const,
  initialItems: [makeItem('1'), makeItem('2')],
  isEditor: false,
  supabaseUrl: 'https://example.supabase.co',
}

beforeEach(() => localStorage.clear())

describe('CollectionGrid view toggle', () => {
  it('defaults to grid view', () => {
    render(<CollectionGrid {...defaultProps} />)
    const cards = screen.getAllByTestId('item-card')
    expect(cards[0]).toHaveAttribute('data-layout', 'grid')
  })

  it('switches to list view when toggle is clicked', () => {
    render(<CollectionGrid {...defaultProps} />)
    fireEvent.click(screen.getByTitle('Switch to list view'))
    const cards = screen.getAllByTestId('item-card')
    expect(cards[0]).toHaveAttribute('data-layout', 'list')
  })

  it('persists view mode to localStorage', () => {
    render(<CollectionGrid {...defaultProps} />)
    fireEvent.click(screen.getByTitle('Switch to list view'))
    expect(localStorage.getItem('view_alice_vinyl')).toBe('list')
  })

  it('restores view mode from localStorage', () => {
    localStorage.setItem('view_alice_vinyl', 'list')
    render(<CollectionGrid {...defaultProps} />)
    const cards = screen.getAllByTestId('item-card')
    expect(cards[0]).toHaveAttribute('data-layout', 'list')
  })

  it('toggles back to grid from list', () => {
    localStorage.setItem('view_alice_vinyl', 'list')
    render(<CollectionGrid {...defaultProps} />)
    fireEvent.click(screen.getByTitle('Switch to grid view'))
    const cards = screen.getAllByTestId('item-card')
    expect(cards[0]).toHaveAttribute('data-layout', 'grid')
    expect(localStorage.getItem('view_alice_vinyl')).toBe('grid')
  })
})

describe('CollectionGrid status filter', () => {
  const consumed = makeItem('consumed', { status: 'consumed' })
  const unread = makeItem('unread', { status: null })

  const propsWithMixed = {
    ...defaultProps,
    initialItems: [consumed, unread],
  }

  it('shows All items by default', () => {
    render(<CollectionGrid {...propsWithMixed} />)
    expect(screen.getAllByTestId('item-card')).toHaveLength(2)
  })

  it('shows Unread filter after first click', () => {
    render(<CollectionGrid {...propsWithMixed} />)
    fireEvent.click(screen.getByTitle('Cycle: All → Unread → Read'))
    const cards = screen.getAllByTestId('item-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('Album unread')
  })

  it('shows Read filter after second click', () => {
    render(<CollectionGrid {...propsWithMixed} />)
    const btn = screen.getByTitle('Cycle: All → Unread → Read')
    fireEvent.click(btn)
    fireEvent.click(btn)
    const cards = screen.getAllByTestId('item-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('Album consumed')
  })

  it('returns to All items after third click', () => {
    render(<CollectionGrid {...propsWithMixed} />)
    const btn = screen.getByTitle('Cycle: All → Unread → Read')
    fireEvent.click(btn)
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(screen.getAllByTestId('item-card')).toHaveLength(2)
  })

  it('does not show status filter chip for lego collection', () => {
    render(<CollectionGrid {...propsWithMixed} collection="lego" />)
    expect(screen.queryByTitle('Cycle: All → Unread → Read')).toBeNull()
  })

  it('does not show status filter chip when viewing wishlist', () => {
    const wishlistItems = [makeItem('w1', { is_wishlist: true })]
    render(<CollectionGrid {...defaultProps} initialItems={wishlistItems} />)
    // switch to wishlist tab
    fireEvent.click(screen.getByText('Wishlist'))
    expect(screen.queryByTitle('Cycle: All → Unread → Read')).toBeNull()
  })
})
