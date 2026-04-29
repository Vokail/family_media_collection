/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

import StatsView from '@/components/StatsView'
import type { Item, CollectionType } from '@/lib/types'

const makeItem = (id: string, overrides: Partial<Item> = {}): Item => ({
  id,
  member_id: 'uuid-1',
  collection: 'vinyl',
  title: `Item ${id}`,
  creator: 'Creator',
  year: 2020,
  cover_path: null,
  is_wishlist: false,
  notes: null,
  tracklist: null,
  sort_name: null,
  external_id: null,
  isbn: null,
  description: null,
  rating: null,
  genres: null,
  styles: null,
  status: null,
  lego_status: null,
  created_at: new Date().toISOString(),
  ...overrides,
})

describe('StatsView — totals', () => {
  it('shows owned and wishlist counts', () => {
    const items = [
      makeItem('1'),
      makeItem('2'),
      makeItem('3', { is_wishlist: true }),
    ]
    render(<StatsView items={items} />)
    // The owned count card has a sibling label "Owned"
    const ownedCard = screen.getByText('Owned').closest('div')!
    expect(ownedCard).toHaveTextContent('2')
    const wishlistCard = screen.getByText('Wishlist').closest('div')!
    expect(wishlistCard).toHaveTextContent('1')
  })

  it('shows empty state when no owned items', () => {
    render(<StatsView items={[]} />)
    expect(screen.getByText(/no owned items/i)).toBeInTheDocument()
  })
})

// Helper: click a stats tab by its button label
function clickTab(name: string) {
  fireEvent.click(screen.getAllByRole('button', { name })[0])
}

describe('StatsView — status breakdown', () => {
  const vinylItems = [
    makeItem('1', { collection: 'vinyl', status: 'consumed' }),
    makeItem('2', { collection: 'vinyl', status: 'consumed' }),
    makeItem('3', { collection: 'vinyl', status: null }),
  ]

  it('does not show status breakdown on All tab', () => {
    render(<StatsView items={vinylItems} />)
    expect(screen.queryByTestId('status-breakdown')).not.toBeInTheDocument()
  })

  it('shows listening status for vinyl tab', () => {
    render(<StatsView items={vinylItems} />)
    clickTab('Vinyl')
    expect(screen.getByTestId('status-breakdown')).toBeInTheDocument()
    expect(screen.getByText('Listening status')).toBeInTheDocument()
    expect(screen.getByText('Listened')).toBeInTheDocument()
    expect(screen.getByText('Not yet')).toBeInTheDocument()
  })

  it('shows reading status for books tab', () => {
    const bookItems = [
      makeItem('1', { collection: 'book', status: 'consumed' }),
      makeItem('2', { collection: 'book', status: null }),
    ]
    render(<StatsView items={bookItems} />)
    clickTab('Books')
    expect(screen.getByText('Reading status')).toBeInTheDocument()
    expect(screen.getByText('Read')).toBeInTheDocument()
    expect(screen.getByText('Not yet')).toBeInTheDocument()
  })

  it('shows reading status for comics tab', () => {
    const comicItems = [makeItem('1', { collection: 'comic', status: null })]
    render(<StatsView items={comicItems} />)
    clickTab('Comics')
    expect(screen.getByText('Reading status')).toBeInTheDocument()
  })

  it('does not show status breakdown when all items are wishlist', () => {
    const items = [makeItem('1', { collection: 'vinyl', is_wishlist: true })]
    render(<StatsView items={items} />)
    clickTab('Vinyl')
    expect(screen.queryByTestId('status-breakdown')).not.toBeInTheDocument()
  })
})

describe('StatsView — lego build status', () => {
  const legoItems = [
    makeItem('1', { collection: 'lego', lego_status: 'built' }),
    makeItem('2', { collection: 'lego', lego_status: 'built' }),
    makeItem('3', { collection: 'lego', lego_status: 'in_box' }),
    makeItem('4', { collection: 'lego', lego_status: 'disassembled' }),
    makeItem('5', { collection: 'lego', lego_status: null }),
  ]

  it('shows build status section on Lego tab', () => {
    render(<StatsView items={legoItems} />)
    clickTab('Lego')
    expect(screen.getByText('Build status')).toBeInTheDocument()
  })

  it('shows all three lego states', () => {
    render(<StatsView items={legoItems} />)
    clickTab('Lego')
    expect(screen.getByText('🔨 Built')).toBeInTheDocument()
    expect(screen.getByText('📦 In box')).toBeInTheDocument()
    expect(screen.getByText('🔧 Apart')).toBeInTheDocument()
  })

  it('does not show Listened/Read labels on Lego tab', () => {
    render(<StatsView items={legoItems} />)
    clickTab('Lego')
    expect(screen.queryByText('Listened')).not.toBeInTheDocument()
    expect(screen.queryByText('Read')).not.toBeInTheDocument()
  })
})

describe('StatsView — ratings', () => {
  it('shows ratings distribution when items are rated', () => {
    const items = [
      makeItem('1', { rating: 5 }),
      makeItem('2', { rating: 5 }),
      makeItem('3', { rating: 3 }),
    ]
    render(<StatsView items={items} />)
    expect(screen.getByText(/ratings/i)).toBeInTheDocument()
    expect(screen.getByText(/favourites/i)).toBeInTheDocument()
  })

  it('hides ratings section when no items are rated', () => {
    render(<StatsView items={[makeItem('1')]} />)
    expect(screen.queryByText(/ratings/i)).not.toBeInTheDocument()
  })
})

describe('StatsView — decades', () => {
  it('shows decade breakdown when items have years', () => {
    const items = [
      makeItem('1', { year: 1975 }),
      makeItem('2', { year: 1978 }),
      makeItem('3', { year: 2010 }),
    ]
    render(<StatsView items={items} />)
    expect(screen.getByText('1970s')).toBeInTheDocument()
    expect(screen.getByText('2010s')).toBeInTheDocument()
  })
})
