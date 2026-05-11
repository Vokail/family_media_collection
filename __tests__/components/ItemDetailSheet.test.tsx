/**
 * @jest-environment jsdom
 *
 * Unit tests for ItemDetailSheet (#139).
 *
 * ItemDetailSheet is the bottom-sheet component extracted from ItemCard.
 * It owns all edit operations (notes, meta, rating, status, lego status,
 * condition, wishlist toggle, cover management, delete).
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

jest.mock('@/components/PhotoCapture', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Toast', () => ({
  __esModule: true,
  useToast: () => ({ show: jest.fn() }),
}))

import ItemDetailSheet from '@/components/ItemDetailSheet'
import type { Item } from '@/lib/types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const base: Item = {
  id: 'item-1',
  member_id: 'mem-1',
  collection: 'vinyl',
  title: 'Abbey Road',
  creator: 'The Beatles',
  year: 1969,
  cover_path: null,
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

function mkFetch(overrides?: Partial<{ ok: boolean; body: object }>) {
  const ok = overrides?.ok ?? true
  const body = overrides?.body ?? { ...base }
  return jest.fn().mockResolvedValue({ ok, json: async () => body })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ItemDetailSheet — rendering', () => {
  it('shows item title and creator', () => {
    render(<ItemDetailSheet item={base} isEditor={false} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.getByText('Abbey Road')).toBeInTheDocument()
    expect(screen.getByText(/The Beatles/)).toBeInTheDocument()
  })

  it('shows tracklist when present', () => {
    const item = { ...base, tracklist: [{ position: 'A1', title: 'Come Together', duration: '4:20' }] }
    render(<ItemDetailSheet item={item} isEditor={false} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.getByText('Come Together')).toBeInTheDocument()
    expect(screen.getByText('4:20')).toBeInTheDocument()
  })

  it('shows reader notes for viewer', () => {
    const item = { ...base, notes: 'Great album!' }
    render(<ItemDetailSheet item={item} isEditor={false} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.getByText(/Great album!/)).toBeInTheDocument()
  })
})

describe('ItemDetailSheet — close behaviour', () => {
  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    render(<ItemDetailSheet item={base} isEditor={false} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    render(<ItemDetailSheet item={base} isEditor={false} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ItemDetailSheet — editor: notes', () => {
  it('shows notes textarea and save button for editor', () => {
    render(<ItemDetailSheet item={base} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.getByPlaceholderText(/personal note/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save note/i })).toBeInTheDocument()
  })

  it('does NOT show notes textarea for viewer', () => {
    render(<ItemDetailSheet item={base} isEditor={false} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.queryByPlaceholderText(/personal note/i)).not.toBeInTheDocument()
  })

  it('sends PATCH with notes on save', async () => {
    global.fetch = mkFetch({ body: { ...base, notes: 'My note' } })
    const onUpdate = jest.fn()
    render(<ItemDetailSheet item={base} isEditor={true} onUpdate={onUpdate} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    fireEvent.change(screen.getByPlaceholderText(/personal note/i), { target: { value: 'My note' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save note/i })) })
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.notes).toBe('My note')
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ notes: 'My note' }))
  })
})

describe('ItemDetailSheet — editor: meta edit', () => {
  it('shows edit pencil button for editor', () => {
    render(<ItemDetailSheet item={base} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.getByTitle(/edit title/i)).toBeInTheDocument()
  })

  it('opens edit form on pencil click', () => {
    render(<ItemDetailSheet item={base} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    fireEvent.click(screen.getByTitle(/edit title/i))
    expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Artist / Author')).toBeInTheDocument()
  })

  it('shows Sort name field for vinyl', () => {
    render(<ItemDetailSheet item={base} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    fireEvent.click(screen.getByTitle(/edit title/i))
    expect(screen.getByPlaceholderText(/Sort name/i)).toBeInTheDocument()
  })

  it('does NOT show Sort name field for books', () => {
    render(<ItemDetailSheet item={{ ...base, collection: 'book' }} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    fireEvent.click(screen.getByTitle(/edit title/i))
    expect(screen.queryByPlaceholderText(/Sort name/i)).not.toBeInTheDocument()
  })

  it('sends correct PATCH body on meta save', async () => {
    global.fetch = mkFetch({ body: { ...base, title: 'Let It Be' } })
    const onUpdate = jest.fn()
    render(<ItemDetailSheet item={base} isEditor={true} onUpdate={onUpdate} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    fireEvent.click(screen.getByTitle(/edit title/i))
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Let It Be' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Save$/i })) })
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.title).toBe('Let It Be')
  })
})

describe('ItemDetailSheet — editor: delete', () => {
  it('shows Delete button, requires confirmation', () => {
    render(<ItemDetailSheet item={base} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Yes, delete/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }))
    expect(screen.getByRole('button', { name: /Yes, delete/i })).toBeInTheDocument()
  })

  it('calls onDelete and onClose after confirmed delete', async () => {
    global.fetch = mkFetch({ body: {} })
    const onDelete = jest.fn()
    const onClose = jest.fn()
    render(<ItemDetailSheet item={base} isEditor={true} onUpdate={noop} onDelete={onDelete} supabaseUrl="https://x.co" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Yes, delete/i })) })
    expect(onDelete).toHaveBeenCalledWith('item-1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ItemDetailSheet — editor: wishlist toggle', () => {
  it('shows "Move to Wishlist" for owned items', () => {
    render(<ItemDetailSheet item={base} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.getByRole('button', { name: /Move to Wishlist/i })).toBeInTheDocument()
  })

  it('shows "Mark as Owned" for wishlist items', () => {
    render(<ItemDetailSheet item={{ ...base, is_wishlist: true }} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.getByRole('button', { name: /Mark as Owned/i })).toBeInTheDocument()
  })
})

describe('ItemDetailSheet — lego build status', () => {
  const legoItem = { ...base, collection: 'lego' as const }

  it('shows build status buttons for editor', () => {
    render(<ItemDetailSheet item={legoItem} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.getByRole('button', { name: /In box/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Built/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Apart/i })).toBeInTheDocument()
  })

  it('sends PATCH with lego_status on button click', async () => {
    global.fetch = mkFetch({ body: { ...legoItem, lego_status: 'built' } })
    const onUpdate = jest.fn()
    render(<ItemDetailSheet item={legoItem} isEditor={true} onUpdate={onUpdate} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Built/i })) })
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.lego_status).toBe('built')
  })
})

describe('ItemDetailSheet — vinyl condition', () => {
  it('shows condition buttons for vinyl', () => {
    render(<ItemDetailSheet item={base} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.getByTitle('Mint')).toBeInTheDocument()
    expect(screen.getByTitle('Near Mint')).toBeInTheDocument()
  })

  it('does NOT show condition buttons for books', () => {
    render(<ItemDetailSheet item={{ ...base, collection: 'book' }} isEditor={true} onUpdate={noop} onDelete={noop} supabaseUrl="https://x.co" onClose={noop} />)
    expect(screen.queryByTitle('Mint')).not.toBeInTheDocument()
  })
})
