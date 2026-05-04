/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

// --- mocks ---
jest.mock('next/navigation', () => ({
  useParams: () => ({ member: 'alice', collection: 'book' }),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
jest.mock('@/components/BarcodeScanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/PhotoCapture', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/SearchResults', () => ({
  __esModule: true,
  default: ({ results }: { results: unknown[] }) => (
    <ul>{results.map((_, i) => <li key={i}>result {i}</li>)}</ul>
  ),
}))
jest.mock('@/components/Toast', () => ({
  __esModule: true,
  useToast: () => ({ show: jest.fn() }),
}))
jest.mock('@/lib/apis/openlibrary', () => ({
  searchOpenLibrary: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/lib/utils', () => ({ toTitleCase: (s: string) => s }))

global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] })

import AddItemPage from '@/app/[member]/[collection]/add/page'

beforeEach(() => {
  (fetch as jest.Mock).mockReset()
  ;(fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] })
  // Reset scroll position
  Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 })
  window.scrollTo = jest.fn()
})

describe('AddItemPage — back to top button', () => {
  it('is not visible on initial render', async () => {
    await act(async () => { render(<AddItemPage />) })
    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
  })

  it('appears after scrolling past 300px', async () => {
    await act(async () => { render(<AddItemPage />) })
    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 350 })
      fireEvent.scroll(window)
    })
    expect(screen.getByRole('button', { name: /back to top/i })).toBeInTheDocument()
  })

  it('hides again when scrolled back above 300px', async () => {
    await act(async () => { render(<AddItemPage />) })
    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 350 })
      fireEvent.scroll(window)
    })
    expect(screen.getByRole('button', { name: /back to top/i })).toBeInTheDocument()

    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 100 })
      fireEvent.scroll(window)
    })
    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
  })

  it('calls window.scrollTo({ top: 0 }) when clicked', async () => {
    await act(async () => { render(<AddItemPage />) })
    act(() => {
      Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 350 })
      fireEvent.scroll(window)
    })
    fireEvent.click(screen.getByRole('button', { name: /back to top/i }))
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})
