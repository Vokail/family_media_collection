/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'

// Forward `prefetch` as a data attribute so we can assert on it in tests
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, prefetch }: { children: React.ReactNode; href: string; prefetch?: boolean }) => (
    <a href={href} data-prefetch={prefetch === false ? 'false' : 'default'}>{children}</a>
  ),
}))

import MemberCard from '@/components/MemberCard'

const MEMBER = { id: 'uuid-1', name: 'Alice', slug: 'alice' }

describe('MemberCard', () => {
  it('shows all four collections with counts when provided', () => {
    render(<MemberCard member={MEMBER} counts={{ vinyl: 5, book: 3, comic: 0, lego: 2 }} />)
    expect(screen.getByText(/🎵 5/)).toBeInTheDocument()
    expect(screen.getByText(/📚 3/)).toBeInTheDocument()
    expect(screen.getByText(/🦸 0/)).toBeInTheDocument()
    expect(screen.getByText(/🧱 2/)).toBeInTheDocument()
  })

  it('shows all four collections as 0 when counts is undefined', () => {
    render(<MemberCard member={MEMBER} />)
    expect(screen.getByText(/🎵 0/)).toBeInTheDocument()
    expect(screen.getByText(/📚 0/)).toBeInTheDocument()
    expect(screen.getByText(/🦸 0/)).toBeInTheDocument()
    expect(screen.getByText(/🧱 0/)).toBeInTheDocument()
  })

  it('shows all four collections as 0 when counts is empty', () => {
    render(<MemberCard member={MEMBER} counts={{}} />)
    expect(screen.getByText(/🎵 0/)).toBeInTheDocument()
    expect(screen.getByText(/📚 0/)).toBeInTheDocument()
    expect(screen.getByText(/🦸 0/)).toBeInTheDocument()
    expect(screen.getByText(/🧱 0/)).toBeInTheDocument()
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
    render(<MemberCard member={{ ...MEMBER, enabled_collections: ['vinyl'] }} counts={{ vinyl: 7 }} />)
    expect(screen.getByText(/🎵 7/)).toBeInTheDocument()
    expect(screen.queryByText(/📚/)).not.toBeInTheDocument()
    expect(screen.queryByText(/🦸/)).not.toBeInTheDocument()
    expect(screen.queryByText(/🧱/)).not.toBeInTheDocument()
  })

  it('shows only the enabled collection badges when enabled_collections has two entries', () => {
    render(<MemberCard member={{ ...MEMBER, enabled_collections: ['book', 'lego'] }} counts={{ book: 3, lego: 1 }} />)
    expect(screen.getByText(/📚 3/)).toBeInTheDocument()
    expect(screen.getByText(/🧱 1/)).toBeInTheDocument()
    expect(screen.queryByText(/🎵/)).not.toBeInTheDocument()
    expect(screen.queryByText(/🦸/)).not.toBeInTheDocument()
  })

  it('badge row has justify-center so a single badge is centred, not left-aligned (#146)', () => {
    const { container } = render(
      <MemberCard member={{ ...MEMBER, enabled_collections: ['vinyl'] }} counts={{ vinyl: 12 }} />,
    )
    // The flex container must carry justify-center regardless of how many badges are inside
    const badgeRow = container.querySelector('.flex.gap-2')
    expect(badgeRow).not.toBeNull()
    expect(badgeRow).toHaveClass('justify-center')
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
// On a narrow 2-column grid (mobile) the badge row was "flex nowrap" with no
// whitespace-nowrap on spans, so "🎵 5" would split to "🎵\n5" inside each
// span, and 4-collection cards grew taller than 1-collection cards.
//
// Fix:
//   • flex-wrap on the container → badges wrap to a 2nd row rather than
//     squishing and splitting intra-span
//   • whitespace-nowrap on each span → "🎵 5" always stays on one line
//   • min-h-10 + content-center on the container → fixed-height badge area so
//     1-badge and 4-badge cards occupy the same vertical space

describe('MemberCard — equal-height cards (#148)', () => {
  it('badge row container has flex-wrap so badges can flow to a 2nd row rather than squishing', () => {
    const { container } = render(<MemberCard member={MEMBER} counts={{ vinyl: 5, book: 3, comic: 0, lego: 2 }} />)
    const badgeRow = container.querySelector('.flex.gap-2')
    expect(badgeRow).not.toBeNull()
    expect(badgeRow).toHaveClass('flex-wrap')
  })

  it('badge row container has min-h-10 so 1-badge cards match the height of 4-badge cards', () => {
    const { container } = render(
      <MemberCard member={{ ...MEMBER, enabled_collections: ['vinyl'] }} counts={{ vinyl: 3 }} />,
    )
    const badgeRow = container.querySelector('.flex.gap-2')
    expect(badgeRow).toHaveClass('min-h-10')
  })

  it('badge row container has content-center so single-row badges are vertically centred in the min-height area', () => {
    const { container } = render(
      <MemberCard member={{ ...MEMBER, enabled_collections: ['vinyl'] }} counts={{ vinyl: 3 }} />,
    )
    const badgeRow = container.querySelector('.flex.gap-2')
    expect(badgeRow).toHaveClass('content-center')
  })

  it('each badge span has whitespace-nowrap so "🎵 5" never splits to two lines (#148)', () => {
    const { container } = render(<MemberCard member={MEMBER} counts={{ vinyl: 5, book: 3, comic: 0, lego: 2 }} />)
    const spans = container.querySelectorAll('.flex.gap-2 span')
    expect(spans.length).toBeGreaterThan(0)
    spans.forEach(span => {
      expect(span).toHaveClass('whitespace-nowrap')
    })
  })

  it('single-badge cards and four-badge cards both render the badge area (regression guard)', () => {
    const { container: c1 } = render(
      <MemberCard member={{ ...MEMBER, enabled_collections: ['vinyl'] }} counts={{ vinyl: 1 }} />,
    )
    const { container: c4 } = render(
      <MemberCard member={{ ...MEMBER, id: 'uuid-2', slug: 'bob', enabled_collections: ['vinyl', 'book', 'comic', 'lego'] }} counts={{ vinyl: 5, book: 3, comic: 1, lego: 2 }} />,
    )
    expect(c1.querySelector('.flex.gap-2')).toHaveClass('min-h-10')
    expect(c4.querySelector('.flex.gap-2')).toHaveClass('min-h-10')
  })
})
