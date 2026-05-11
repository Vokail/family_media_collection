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
  default: ({ item, layout, forceOpen }: { item: { id: string; title: string }; layout?: string; forceOpen?: boolean }) => (
    <div data-testid="item-card" data-layout={layout ?? 'grid'} data-force-open={forceOpen ? 'true' : 'false'}>{item.title}</div>
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

  it('sidebar nav calls scrollIntoView after switching sort mode (#117)', () => {
    // Regression: a useEffect was wiping sectionRefs.current after every sort change,
    // so sidebar buttons stopped working. After the fix the refs must remain populated.
    const scrollIntoViewMock = jest.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

    render(<CollectionGrid {...defaultProps} initialItems={items} />)

    // First switch to creator sort (populates different refs), then back to title.
    // With the old bug both sort changes would clear the refs, leaving the sidebar dead.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'creator' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'title' } })

    // Click the 'A' sidebar button — must call scrollIntoView on the A section element.
    const sidebarA = screen.getAllByRole('button').find(b => b.textContent === 'A')
    expect(sidebarA).toBeDefined()
    fireEvent.click(sidebarA!)

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })
})

describe('CollectionGrid Surprise button', () => {
  const bookProps = { ...defaultProps, collection: 'book' as const }

  const readItem = makeItem('r1', { collection: 'book', status: 'consumed' })
  const unreadItem = makeItem('u1', { collection: 'book', status: null })

  it('is visible when there are owned items', () => {
    render(<CollectionGrid {...bookProps} initialItems={[readItem, unreadItem]} />)
    expect(screen.getByTitle('Surprise me — pick a random item')).toBeInTheDocument()
  })

  it('is not visible when there are no items at all', () => {
    render(<CollectionGrid {...bookProps} initialItems={[]} />)
    expect(screen.queryByTitle('Surprise me — pick a random item')).toBeNull()
  })

  it('remains visible when on Read filter with no read items', () => {
    render(<CollectionGrid {...bookProps} initialItems={[unreadItem]} />)
    fireEvent.click(screen.getByText('✓ Read'))
    // filtered view is empty but button must still appear
    expect(screen.getByTitle('Surprise me — pick a random item')).toBeInTheDocument()
  })

  it('remains visible when on Unread filter with no unread items', () => {
    render(<CollectionGrid {...bookProps} initialItems={[readItem]} />)
    fireEvent.click(screen.getByText('Unread'))
    expect(screen.getByTitle('Surprise me — pick a random item')).toBeInTheDocument()
  })

  it('picks only from read items when Read filter is active and has results', () => {
    render(<CollectionGrid {...bookProps} initialItems={[readItem, unreadItem]} />)
    fireEvent.click(screen.getByText('✓ Read'))
    fireEvent.click(screen.getByTitle('Surprise me — pick a random item'))
    const openCards = screen.getAllByTestId('item-card').filter(c => c.getAttribute('data-force-open') === 'true')
    expect(openCards).toHaveLength(1)
    expect(openCards[0]).toHaveTextContent('Album r1')
  })

  it('picks only from unread items when Unread filter is active and has results', () => {
    render(<CollectionGrid {...bookProps} initialItems={[readItem, unreadItem]} />)
    fireEvent.click(screen.getByText('Unread'))
    fireEvent.click(screen.getByTitle('Surprise me — pick a random item'))
    const openCards = screen.getAllByTestId('item-card').filter(c => c.getAttribute('data-force-open') === 'true')
    expect(openCards).toHaveLength(1)
    expect(openCards[0]).toHaveTextContent('Album u1')
  })

  it('falls back to all owned items when Read filter has no results', () => {
    // Only unread item — Read filter yields empty set
    render(<CollectionGrid {...bookProps} initialItems={[unreadItem]} />)
    fireEvent.click(screen.getByText('✓ Read'))
    fireEvent.click(screen.getByTitle('Surprise me — pick a random item'))
    // Falls back to full owned tab — unreadItem should be force-opened
    const openCards = screen.getAllByTestId('item-card').filter(c => c.getAttribute('data-force-open') === 'true')
    expect(openCards).toHaveLength(1)
    expect(openCards[0]).toHaveTextContent('Album u1')
  })

  it('falls back to all owned items when Unread filter has no results', () => {
    render(<CollectionGrid {...bookProps} initialItems={[readItem]} />)
    fireEvent.click(screen.getByText('Unread'))
    fireEvent.click(screen.getByTitle('Surprise me — pick a random item'))
    const openCards = screen.getAllByTestId('item-card').filter(c => c.getAttribute('data-force-open') === 'true')
    expect(openCards).toHaveLength(1)
    expect(openCards[0]).toHaveTextContent('Album r1')
  })
})

describe('CollectionGrid author last-name sort (#120)', () => {
  // Books and comics should sort/group by last name; vinyl should not.
  const bookItems = [
    makeItem('b1', { collection: 'book', creator: 'Frank Herbert' }),      // → H
    makeItem('b2', { collection: 'book', creator: 'Ursula K. Le Guin' }), // → G (last word)
    makeItem('b3', { collection: 'book', creator: 'Stephen King' }),       // → K
    makeItem('b4', { collection: 'book', creator: 'Asimov' }),             // single word → A
  ]

  it('groups book authors by last name initial when sorted by creator', () => {
    render(<CollectionGrid {...defaultProps} collection="book" initialItems={bookItems} />)
    // Default sort is creator — confirm H, G, K, A section headers appear
    expect(screen.getAllByText('H').length).toBeGreaterThanOrEqual(1)  // Herbert
    expect(screen.getAllByText('G').length).toBeGreaterThanOrEqual(1)  // Le Guin
    expect(screen.getAllByText('K').length).toBeGreaterThanOrEqual(1)  // King
    expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(1)  // Asimov
    // No "F" section (Frank should NOT be the sort key)
    expect(screen.queryAllByText('F')).toHaveLength(0)
    // No "U" section (Ursula should NOT be the sort key)
    expect(screen.queryAllByText('U')).toHaveLength(0)
  })

  it('sorts book items in last-name alphabetical order', () => {
    render(<CollectionGrid {...defaultProps} collection="book" initialItems={bookItems} />)
    const cards = screen.getAllByTestId('item-card')
    const titles = cards.map(c => c.textContent)
    // Expected order: Asimov (A), Le Guin (G), Herbert (H), King (K)
    const asimovIdx = titles.findIndex(t => t?.includes('Asimov') || titles.indexOf(t) === titles.indexOf('Album b4'))
    const leGuinIdx = titles.findIndex(t => t?.includes('Le Guin') || titles.indexOf(t) === titles.indexOf('Album b2'))
    const herbertIdx = titles.findIndex(t => t?.includes('Herbert') || titles.indexOf(t) === titles.indexOf('Album b1'))
    const kingIdx = titles.findIndex(t => t?.includes('King') || titles.indexOf(t) === titles.indexOf('Album b3'))
    // Compare by card rendering order (item titles are the mock text)
    const rendered = cards.map(c => c.textContent)
    expect(rendered.indexOf('Album b4')).toBeLessThan(rendered.indexOf('Album b2')) // A < G
    expect(rendered.indexOf('Album b2')).toBeLessThan(rendered.indexOf('Album b1')) // G < H
    expect(rendered.indexOf('Album b1')).toBeLessThan(rendered.indexOf('Album b3')) // H < K
    void [asimovIdx, leGuinIdx, herbertIdx, kingIdx] // used implicitly via rendered checks
  })

  it('does NOT use last-name sort for vinyl — groups by full first word', () => {
    const vinylItems = [
      makeItem('v1', { collection: 'vinyl', creator: 'Frank Sinatra' }),   // → F
      makeItem('v2', { collection: 'vinyl', creator: 'David Bowie' }),     // → D
    ]
    render(<CollectionGrid {...defaultProps} collection="vinyl" initialItems={vinylItems} />)
    // Vinyl sorts by first word → F and D sections, not S and B
    expect(screen.getAllByText('F').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('D').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText('S')).toHaveLength(0) // Sinatra last-name NOT used
    expect(screen.queryAllByText('B')).toHaveLength(0) // Bowie last-name NOT used
  })

  it('applies last-name grouping to comics too', () => {
    const comicItems = [
      makeItem('c1', { collection: 'comic', creator: 'Alan Moore' }),  // → M
      makeItem('c2', { collection: 'comic', creator: 'Neil Gaiman' }), // → G
    ]
    render(<CollectionGrid {...defaultProps} collection="comic" initialItems={comicItems} />)
    expect(screen.getAllByText('M').length).toBeGreaterThanOrEqual(1)  // Moore
    expect(screen.getAllByText('G').length).toBeGreaterThanOrEqual(1)  // Gaiman
    expect(screen.queryAllByText('A')).toHaveLength(0) // Alan NOT used
    expect(screen.queryAllByText('N')).toHaveLength(0) // Neil NOT used
  })
})
