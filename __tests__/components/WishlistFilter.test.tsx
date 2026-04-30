/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// WishlistList renders ItemCard which is complex — stub it out
jest.mock('@/components/WishlistList', () => ({
  __esModule: true,
  default: ({ initialItems }: { initialItems: { id: string; title: string }[] }) => (
    <ul data-testid="wishlist-list">
      {initialItems.map(i => <li key={i.id}>{i.title}</li>)}
    </ul>
  ),
}))

import WishlistFilter from '@/components/WishlistFilter'
import type { Item, Member } from '@/lib/types'

const MEMBERS: Member[] = [
  { id: 'm1', name: 'Alice', slug: 'alice', enabled_collections: ['vinyl', 'book', 'comic', 'lego'] },
  { id: 'm2', name: 'Bob', slug: 'bob', enabled_collections: ['vinyl', 'book', 'comic', 'lego'] },
]

function makeItem(overrides: Partial<Item> & { id: string; title: string; member_id: string; collection: Item['collection'] }): Item {
  return {
    creator: 'Unknown',
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
    ...overrides,
  }
}

const ITEMS: Item[] = [
  makeItem({ id: 'i1', title: 'Dark Side', creator: 'Pink Floyd', member_id: 'm1', collection: 'vinyl' }),
  makeItem({ id: 'i2', title: 'Dune', creator: 'Frank Herbert', member_id: 'm1', collection: 'book' }),
  makeItem({ id: 'i3', title: 'Watchmen', creator: 'Alan Moore', member_id: 'm2', collection: 'comic' }),
]

const DEFAULT_PROPS = {
  members: MEMBERS,
  initialItems: ITEMS,
  isEditor: false,
  supabaseUrl: 'https://example.supabase.co',
}

describe('WishlistFilter', () => {
  describe('collection filter pills', () => {
    it('shows all items when All pill is active (default)', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      expect(screen.getByText('Dark Side')).toBeInTheDocument()
      expect(screen.getByText('Dune')).toBeInTheDocument()
      expect(screen.getByText('Watchmen')).toBeInTheDocument()
    })

    it('filters to only vinyl items when Vinyl pill is clicked', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Vinyl' }))
      expect(screen.getByText('Dark Side')).toBeInTheDocument()
      expect(screen.queryByText('Dune')).not.toBeInTheDocument()
      expect(screen.queryByText('Watchmen')).not.toBeInTheDocument()
    })

    it('filters to only book items when Books pill is clicked', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Books' }))
      expect(screen.queryByText('Dark Side')).not.toBeInTheDocument()
      expect(screen.getByText('Dune')).toBeInTheDocument()
      expect(screen.queryByText('Watchmen')).not.toBeInTheDocument()
    })

    it('clicking the active pill again resets to All', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Vinyl' }))
      fireEvent.click(screen.getByRole('button', { name: 'Vinyl' }))
      expect(screen.getByText('Dark Side')).toBeInTheDocument()
      expect(screen.getByText('Dune')).toBeInTheDocument()
      expect(screen.getByText('Watchmen')).toBeInTheDocument()
    })

    it('shows "No items match" when filter yields no results', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.click(screen.getByRole('button', { name: 'Lego' }))
      expect(screen.getByText('No items match your search.')).toBeInTheDocument()
    })
  })

  describe('search', () => {
    it('filters by title (case-insensitive)', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.change(screen.getByPlaceholderText(/search by title/i), { target: { value: 'dune' } })
      expect(screen.queryByText('Dark Side')).not.toBeInTheDocument()
      expect(screen.getByText('Dune')).toBeInTheDocument()
      expect(screen.queryByText('Watchmen')).not.toBeInTheDocument()
    })

    it('filters by creator (case-insensitive)', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.change(screen.getByPlaceholderText(/search by title/i), { target: { value: 'alan' } })
      expect(screen.queryByText('Dark Side')).not.toBeInTheDocument()
      expect(screen.queryByText('Dune')).not.toBeInTheDocument()
      expect(screen.getByText('Watchmen')).toBeInTheDocument()
    })

    it('shows matched count when query is active', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.change(screen.getByPlaceholderText(/search by title/i), { target: { value: 'dune' } })
      expect(screen.getByText('1 item matched')).toBeInTheDocument()
    })
  })

  describe('clear button', () => {
    it('is hidden when search is empty', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
    })

    it('appears when query is entered', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.change(screen.getByPlaceholderText(/search by title/i), { target: { value: 'dune' } })
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
    })

    it('clears the query and restores all results', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.change(screen.getByPlaceholderText(/search by title/i), { target: { value: 'dune' } })
      fireEvent.click(screen.getByLabelText('Clear search'))
      expect(screen.getByText('Dark Side')).toBeInTheDocument()
      expect(screen.getByText('Dune')).toBeInTheDocument()
      expect(screen.getByText('Watchmen')).toBeInTheDocument()
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
    })
  })

  describe('collapsible sections', () => {
    it('member sections are open by default', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      expect(screen.getByText('Dark Side')).toBeInTheDocument()
    })

    it('clicking the member header collapses that section', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
      expect(screen.queryByText('Dark Side')).not.toBeInTheDocument()
      expect(screen.queryByText('Dune')).not.toBeInTheDocument()
      // Bob's section unaffected
      expect(screen.getByText('Watchmen')).toBeInTheDocument()
    })

    it('clicking again re-expands the section', () => {
      render(<WishlistFilter {...DEFAULT_PROPS} />)
      fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
      fireEvent.click(screen.getByRole('button', { name: /Alice/ }))
      expect(screen.getByText('Dark Side')).toBeInTheDocument()
    })
  })
})
