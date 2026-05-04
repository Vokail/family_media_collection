/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

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

  it('shows only unlistened items when Unlistened is clicked', () => {
    render(<CollectionGrid {...propsWithMixed} />)
    fireEvent.click(screen.getByText('Unlistened'))
    const cards = screen.getAllByTestId('item-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('Album unread')
  })

  it('shows only listened items when Listened is clicked', () => {
    render(<CollectionGrid {...propsWithMixed} />)
    fireEvent.click(screen.getByText('✓ Listened'))
    const cards = screen.getAllByTestId('item-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('Album consumed')
  })

  it('returns to all items when All is clicked', () => {
    render(<CollectionGrid {...propsWithMixed} />)
    fireEvent.click(screen.getByText('Unlistened'))
    fireEvent.click(screen.getByText('All'))
    expect(screen.getAllByTestId('item-card')).toHaveLength(2)
  })

  it('does not show status filter for lego collection', () => {
    render(<CollectionGrid {...propsWithMixed} collection="lego" />)
    // Lego uses its own filter row (Built/In box/Apart) not the status filter
    expect(screen.queryByText('Unlistened')).toBeNull()
    expect(screen.queryByText('Listened')).toBeNull()
  })

  it('does not show status filter when viewing wishlist', () => {
    const wishlistItems = [makeItem('w1', { is_wishlist: true })]
    render(<CollectionGrid {...defaultProps} initialItems={wishlistItems} />)
    fireEvent.click(screen.getByText('Wishlist'))
    expect(screen.queryByText('Unlistened')).toBeNull()
  })
})

describe('CollectionGrid lego filter', () => {
  const legoProps = {
    ...defaultProps,
    collection: 'lego' as const,
    initialItems: [
      makeItem('built', { collection: 'lego', lego_status: 'built' }),
      makeItem('inbox', { collection: 'lego', lego_status: 'in_box' }),
      makeItem('apart', { collection: 'lego', lego_status: 'disassembled' }),
      makeItem('none', { collection: 'lego', lego_status: null }),
    ],
  }

  it('shows all lego items by default', () => {
    render(<CollectionGrid {...legoProps} />)
    expect(screen.getAllByTestId('item-card')).toHaveLength(4)
  })

  it('filters to built items only', () => {
    render(<CollectionGrid {...legoProps} />)
    fireEvent.click(screen.getByText('🔨 Built'))
    const cards = screen.getAllByTestId('item-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('Album built')
  })

  it('filters to in-box items only', () => {
    render(<CollectionGrid {...legoProps} />)
    fireEvent.click(screen.getByText('📦 In box'))
    const cards = screen.getAllByTestId('item-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('Album inbox')
  })

  it('filters to disassembled items only', () => {
    render(<CollectionGrid {...legoProps} />)
    fireEvent.click(screen.getByText('🔧 Apart'))
    const cards = screen.getAllByTestId('item-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('Album apart')
  })

  it('returns to all when All is clicked', () => {
    render(<CollectionGrid {...legoProps} />)
    fireEvent.click(screen.getByText('🔨 Built'))
    expect(screen.getAllByTestId('item-card')).toHaveLength(1)
    // Click "All" again (first "All" button is the lego filter All)
    fireEvent.click(screen.getAllByText('All')[0])
    expect(screen.getAllByTestId('item-card')).toHaveLength(4)
  })

  it('does not show lego filter when viewing wishlist', () => {
    const wishlistItems = [makeItem('w1', { collection: 'lego', is_wishlist: true })]
    render(<CollectionGrid {...legoProps} initialItems={wishlistItems} />)
    fireEvent.click(screen.getByText('Wishlist'))
    expect(screen.queryByText('🔨 Built')).toBeNull()
    expect(screen.queryByText('📦 In box')).toBeNull()
  })
})

describe('CollectionGrid pagination', () => {
  // Build 65 owned items so we exceed PAGE_SIZE (60)
  const manyItems = Array.from({ length: 65 }, (_, i) =>
    makeItem(String(i + 1), { title: `Album ${String(i + 1).padStart(3, '0')}`, creator: 'Artist' })
  )

  // Capture the IntersectionObserver callback so tests can trigger it manually
  let observerCallback: IntersectionObserverCallback
  beforeEach(() => {
    window.IntersectionObserver = jest.fn((cb) => {
      observerCallback = cb
      return { observe: jest.fn(), disconnect: jest.fn() }
    }) as unknown as typeof IntersectionObserver
  })

  it('shows only the first 60 items initially', () => {
    render(<CollectionGrid {...defaultProps} initialItems={manyItems} />)
    expect(screen.getAllByTestId('item-card')).toHaveLength(60)
  })

  it('renders a sentinel element when there are more items', () => {
    render(<CollectionGrid {...defaultProps} initialItems={manyItems} />)
    // The sentinel is an aria-hidden div — check it exists via its aria attribute
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('does not render a sentinel when all items fit on one page', () => {
    render(<CollectionGrid {...defaultProps} initialItems={[makeItem('1'), makeItem('2')]} />)
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('loads more items when sentinel becomes visible', () => {
    render(<CollectionGrid {...defaultProps} initialItems={manyItems} />)
    expect(screen.getAllByTestId('item-card')).toHaveLength(60)
    // Simulate sentinel entering viewport
    act(() => {
      observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(screen.getAllByTestId('item-card')).toHaveLength(65)
  })

  it('resets to first page when sort changes', () => {
    render(<CollectionGrid {...defaultProps} initialItems={manyItems} />)
    // Trigger load more
    act(() => {
      observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(screen.getAllByTestId('item-card')).toHaveLength(65)
    // Change sort — should reset to 60
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'title' } })
    expect(screen.getAllByTestId('item-card')).toHaveLength(60)
  })

  it('resets to first page when search changes', () => {
    render(<CollectionGrid {...defaultProps} initialItems={manyItems} />)
    act(() => {
      observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
    expect(screen.getAllByTestId('item-card')).toHaveLength(65)
    fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: 'Album' } })
    expect(screen.getAllByTestId('item-card')).toHaveLength(60)
  })
})

describe('CollectionGrid title sort grouping', () => {
  const items = [
    makeItem('1', { title: 'Abbey Road' }),
    makeItem('2', { title: 'Born To Run' }),
    makeItem('3', { title: 'Animals' }),
    makeItem('4', { title: 'The Wall' }),       // "The" stripped → W
    makeItem('5', { title: 'A Night At The Opera' }), // "A" stripped → N
    makeItem('6', { title: '1984' }),            // digit → #
  ]

  it('shows letter section headers when sorted by title', () => {
    render(<CollectionGrid {...defaultProps} initialItems={items} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'title' } })
    // A, B, W, N, # sections expected (each letter appears in header + sidebar)
    expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('B').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('W').length).toBeGreaterThanOrEqual(1)
  })

  it('strips leading articles from titles for grouping', () => {
    render(<CollectionGrid {...defaultProps} initialItems={items} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'title' } })
    // "The Wall" → W section, "A Night At The Opera" → N section
    expect(screen.getAllByText('W').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('N').length).toBeGreaterThanOrEqual(1)
    // There should be no "T" section (The Wall must not group under T)
    expect(screen.queryAllByText('T')).toHaveLength(0)
  })

  it('groups digits and non-alpha titles under #', () => {
    render(<CollectionGrid {...defaultProps} initialItems={items} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'title' } })
    expect(screen.getAllByText('#').length).toBeGreaterThanOrEqual(1)
  })

  it('shows A-Z index sidebar when sorted by title', () => {
    render(<CollectionGrid {...defaultProps} initialItems={items} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'title' } })
    // Sidebar buttons for each section letter should exist
    const sidebarButtons = screen.getAllByRole('button').filter(b =>
      ['A', 'B', 'N', 'W', '#'].includes(b.textContent ?? '')
    )
    expect(sidebarButtons.length).toBeGreaterThanOrEqual(4)
  })
})
