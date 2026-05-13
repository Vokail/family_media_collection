/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, within } from '@testing-library/react'

// Forward `prefetch` as a data attribute so we can assert on it in tests
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, prefetch }: { children: React.ReactNode; href: string; prefetch?: boolean }) => (
    <a href={href} data-prefetch={prefetch === false ? 'false' : 'default'}>{children}</a>
  ),
}))

import MemberCard from '@/components/MemberCard'

const MEMBER = { id: 'uuid-1', name: 'Alice', slug: 'alice' }

// Helper: get the badge-row div (has flex-wrap; distinct from the card's flex-col container)
function getBadgeRow(container: HTMLElement) {
  return container.querySelector('.flex-wrap') as HTMLElement
}

// Helper: get all badge <span> elements (direct children of the badge row)
function getBadges(container: HTMLElement) {
  return Array.from(getBadgeRow(container)?.querySelectorAll(':scope > span') ?? [])
}

describe('MemberCard', () => {
  it('shows all four collection emojis and counts when provided', () => {
    const { container } = render(<MemberCard member={MEMBER} counts={{ vinyl: 5, book: 3, comic: 0, lego: 2 }} />)
    const row = getBadgeRow(container)
    expect(within(row).getByText('🎵')).toBeInTheDocument()
    expect(within(row).getByText('5')).toBeInTheDocument()
    expect(within(row).getByText('📚')).toBeInTheDocument()
    expect(within(row).getByText('3')).toBeInTheDocument()
    expect(within(row).getByText('🦸')).toBeInTheDocument()
    expect(within(row).getByText('🧱')).toBeInTheDocument()
    expect(within(row).getByText('2')).toBeInTheDocument()
  })

  it('shows all four collections as 0 when counts is undefined', () => {
    const { container } = render(<MemberCard member={MEMBER} />)
    const row = getBadgeRow(container)
    expect(within(row).getByText('🎵')).toBeInTheDocument()
    expect(within(row).getByText('📚')).toBeInTheDocument()
    expect(within(row).getByText('🦸')).toBeInTheDocument()
    expect(within(row).getByText('🧱')).toBeInTheDocument()
    expect(within(row).getAllByText('0')).toHaveLength(4)
  })

  it('shows all four collections as 0 when counts is empty', () => {
    const { container } = render(<MemberCard member={MEMBER} counts={{}} />)
    const row = getBadgeRow(container)
    expect(within(row).getAllByText('0')).toHaveLength(4)
  })

  it('disables Next.js prefetch (battery): no background SSR for member cards on /members', () => {
    const { container } = render(<MemberCard member={MEMBER} />)
    const link = container.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('data-prefetch')).toBe('false')
  })
})

// ── Single-collection layout (#146) ──────────────────────────────────────────
//
// When a member has only one collection enabled, the badge row was left-aligned
// (flex default), leaving lopsided whitespace on the right side of the card.
// Fix: add justify-center to the badge row flex container.

describe('MemberCard — single-collection layout (#146)', () => {
  it('shows only the enabled collection badge when enabled_collections has one entry', () => {
    const { container } = render(<MemberCard member={{ ...MEMBER, enabled_collections: ['vinyl'] }} counts={{ vinyl: 7 }} />)
    const row = getBadgeRow(container)
    expect(within(row).getByText('🎵')).toBeInTheDocument()
    expect(within(row).queryByText('📚')).not.toBeInTheDocument()
    expect(within(row).queryByText('🦸')).not.toBeInTheDocument()
    expect(within(row).queryByText('🧱')).not.toBeInTheDocument()
  })

  it('shows only the enabled collection badges when enabled_collections has two entries', () => {
    const { container } = render(<MemberCard member={{ ...MEMBER, enabled_collections: ['book', 'lego'] }} counts={{ book: 3, lego: 1 }} />)
    const row = getBadgeRow(container)
    expect(within(row).getByText('📚')).toBeInTheDocument()
    expect(within(row).getByText('🧱')).toBeInTheDocument()
    expect(within(row).queryByText('🎵')).not.toBeInTheDocument()
    expect(within(row).queryByText('🦸')).not.toBeInTheDocument()
  })

  it('badge row has justify-center so a single badge is centred, not left-aligned (#146)', () => {
    const { container } = render(
      <MemberCard member={{ ...MEMBER, enabled_collections: ['vinyl'] }} counts={{ vinyl: 12 }} />,
    )
    expect(getBadgeRow(container)).toHaveClass('justify-center')
  })

  it('link href points to the first enabled collection (#146)', () => {
    const { container } = render(
      <MemberCard member={{ ...MEMBER, enabled_collections: ['book', 'comic'] }} />,
    )
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/alice/book')
  })
})

// ── Equal-height cards (#148) ─────────────────────────────────────────────────
//
// Each badge is a stacked column: icon on top, count below. Because every badge
// has the same two-line structure, 1-badge and 4-badge cards are always the
// same height with no min-h hack required.

describe('MemberCard — equal-height cards (#148)', () => {
  it('each badge renders the icon in the first child span and the count in the second', () => {
    const { container } = render(<MemberCard member={MEMBER} counts={{ vinyl: 5, book: 3, comic: 0, lego: 2 }} />)
    const badges = getBadges(container)
    expect(badges).toHaveLength(4)
    badges.forEach(badge => {
      expect(badge.children.length).toBe(2)
      expect(badge.children[0].tagName).toBe('SPAN') // icon
      expect(badge.children[1].tagName).toBe('SPAN') // count
    })
  })

  it('each badge span has flex-col so icon sits above count', () => {
    const { container } = render(<MemberCard member={MEMBER} counts={{ vinyl: 5, book: 3, comic: 0, lego: 2 }} />)
    getBadges(container).forEach(badge => {
      expect(badge).toHaveClass('flex-col')
    })
  })

  it('each badge span has items-center so icon and count are horizontally centred', () => {
    const { container } = render(<MemberCard member={MEMBER} counts={{ vinyl: 5, book: 3, comic: 0, lego: 2 }} />)
    getBadges(container).forEach(badge => {
      expect(badge).toHaveClass('items-center')
    })
  })

  it('icon and count are in separate child spans — not mixed in a single text node (#148)', () => {
    const { container } = render(
      <MemberCard member={{ ...MEMBER, enabled_collections: ['vinyl'] }} counts={{ vinyl: 7 }} />,
    )
    const [badge] = getBadges(container)
    // First child: emoji only, no digit
    expect(badge.children[0].textContent).toMatch(/🎵/)
    expect(badge.children[0].textContent).not.toMatch(/7/)
    // Second child: count only, no emoji
    expect(badge.children[1].textContent).toBe('7')
  })

  it('single-badge and four-badge cards both use the stacked layout (regression guard)', () => {
    const { container: c1 } = render(
      <MemberCard member={{ ...MEMBER, enabled_collections: ['vinyl'] }} counts={{ vinyl: 1 }} />,
    )
    const { container: c4 } = render(
      <MemberCard member={{ ...MEMBER, id: 'uuid-2', slug: 'bob' }} counts={{ vinyl: 5, book: 3, comic: 1, lego: 2 }} />,
    )
    const [badge1] = getBadges(c1)
    const [badge4] = getBadges(c4)
    expect(badge1.children.length).toBe(2)
    expect(badge4.children.length).toBe(2)
  })
})
