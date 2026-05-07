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
