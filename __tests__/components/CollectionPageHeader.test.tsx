/**
 * @jest-environment jsdom
 *
 * Regression tests for the collection page header layout.
 *
 * #147 — back button alignment: with a long member name the h1 element had
 *   flex-1 but no min-w-0, so its intrinsic text width could overflow its
 *   flex share and push the "← Members" back button off-screen or wrap the
 *   header row.
 *
 * Fix: add min-w-0 (allows the item to shrink below its content width) and
 *   truncate (overflow: hidden + text-overflow: ellipsis) to the h1.
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, act } from '@testing-library/react'

jest.mock('next/navigation', () => ({ notFound: jest.fn(), redirect: jest.fn() }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
jest.mock('@/lib/db/members', () => ({ getMemberBySlug: jest.fn() }))
jest.mock('@/lib/db/items',   () => ({ listItems: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/session',    () => ({ getSession: jest.fn() }))
jest.mock('@/components/CollectionGrid', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/constants', () => ({ VALID_COLLECTIONS: ['vinyl', 'book', 'comic', 'lego'] }))

import CollectionPage from '@/app/[member]/[collection]/page'
import { getMemberBySlug } from '@/lib/db/members'
import { getSession }      from '@/lib/session'

const mockGetMember = getMemberBySlug as jest.Mock
const mockGetSession = getSession     as jest.Mock

// A deliberately long name to stress-test the flex layout
const LONG_MEMBER = {
  id: 'uuid-long',
  name: 'Bartholomew Fitzgerald-Cunningham',
  slug: 'bartholomew',
  enabled_collections: ['vinyl', 'book', 'comic', 'lego'],
}

async function renderPage(name = LONG_MEMBER.name) {
  mockGetMember.mockResolvedValue({ ...LONG_MEMBER, name })
  mockGetSession.mockResolvedValue({ role: 'editor' })
  const element = await CollectionPage({
    params: Promise.resolve({ member: 'bartholomew', collection: 'vinyl' }),
  })
  let result!: ReturnType<typeof render>
  await act(async () => { result = render(element) })
  return result
}

// ── Header classes (#147) ─────────────────────────────────────────────────────

describe('CollectionPage — header layout (#147)', () => {
  it('h1 has min-w-0 so it can shrink below its intrinsic text width in the flex row', async () => {
    await renderPage()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('min-w-0')
  })

  it('h1 has truncate so a long name never pushes the back button off-screen', async () => {
    await renderPage()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('truncate')
  })

  it('h1 has flex-1 so it absorbs leftover space between nav links', async () => {
    await renderPage()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveClass('flex-1')
  })

  it('← Members back button is always rendered regardless of name length', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: /← Members/ })).toBeInTheDocument()
  })

  it('Stats link is always rendered regardless of name length', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: /Stats/ })).toBeInTheDocument()
  })

  it('displays the member name in the h1', async () => {
    await renderPage('Bartholomew Fitzgerald-Cunningham')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Bartholomew Fitzgerald-Cunningham',
    )
  })
})
