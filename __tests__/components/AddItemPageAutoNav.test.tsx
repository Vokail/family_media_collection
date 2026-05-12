/**
 * @jest-environment jsdom
 *
 * Regression for #121: after adding an item, AddItemPage schedules a 5-second
 * auto-navigate back to the collection. If the user starts adding ANOTHER item
 * within that window (typing in the search box, tapping the scan button), the
 * auto-navigate must be cancelled — otherwise the user gets yanked away mid-edit.
 *
 * We verify the cancellation by tracking timers + a captured `onAdd` callback
 * (so we can trigger a successful add without needing the full search → click
 * → POST round-trip).
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, act } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useParams: () => ({ member: 'alice', collection: 'book' }),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
jest.mock('@/components/BarcodeScanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/PhotoCapture',  () => ({ __esModule: true, default: () => null }))

// Capture the onAdd prop so the test can trigger a successful add without
// having to wire through a fake search + button click.
type OnAdd = (result: { external_id: string; title: string; creator: string; year: number | null; cover_url: string | null }, isWishlist: boolean) => Promise<void>
let capturedOnAdd: OnAdd | null = null
jest.mock('@/components/SearchResults', () => ({
  __esModule: true,
  default: ({ onAdd }: { onAdd: OnAdd }) => {
    capturedOnAdd = onAdd
    return null
  },
}))
jest.mock('@/components/Toast', () => ({
  __esModule: true,
  useToast: () => ({ show: jest.fn() }),
}))
jest.mock('@/lib/apis/openlibrary', () => ({ searchOpenLibrary: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/utils', () => ({ toTitleCase: (s: string) => s }))
jest.mock('@/lib/navigate', () => ({ navigateTo: jest.fn() }))

global.fetch = jest.fn()

import AddItemPage from '@/app/[member]/[collection]/add/page'
import { navigateTo } from '@/lib/navigate'

const NEW_ITEM = { external_id: 'OL1W', title: 'Dune', creator: 'Frank Herbert', year: 1965, cover_url: null }
const navigateMock = navigateTo as jest.Mock

beforeEach(() => {
  jest.useFakeTimers()
  navigateMock.mockReset()
  ;(fetch as jest.Mock).mockReset()
  // Default: GET /api/items returns []; POST /api/items returns a new row
  ;(fetch as jest.Mock).mockImplementation((_url: string, opts?: { method?: string }) => {
    if ((opts?.method ?? 'GET') === 'POST') {
      return Promise.resolve({ ok: true, json: async () => ({ id: 'new', ...NEW_ITEM, member_id: 'alice', collection: 'book', is_wishlist: false }) })
    }
    return Promise.resolve({ ok: true, json: async () => [] })
  })
})

afterEach(() => {
  jest.useRealTimers()
  capturedOnAdd = null
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function setVisibilityState(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

// ── Suite: interaction cancellation (#121) ────────────────────────────────────

describe('AddItemPage — auto-navigate cancellation (#121)', () => {
  it('does NOT navigate when the user presses a key after adding', async () => {
    await act(async () => { render(<AddItemPage />) })
    expect(capturedOnAdd).not.toBeNull()

    // Simulate a successful add — schedules the 5 s navTimer
    await act(async () => { await capturedOnAdd!(NEW_ITEM, false) })

    // 2 s in, user starts typing another search → must cancel the timer
    await act(async () => { jest.advanceTimersByTime(2000) })
    expect(navigateMock).not.toHaveBeenCalled()
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' })) })

    // Let the rest of the original 5 s elapse + extra slack
    await act(async () => { jest.advanceTimersByTime(10_000) })

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('does NOT navigate when the user taps/clicks after adding', async () => {
    await act(async () => { render(<AddItemPage />) })
    await act(async () => { await capturedOnAdd!(NEW_ITEM, false) })

    await act(async () => { jest.advanceTimersByTime(2000) })
    // jsdom lacks PointerEvent — a plain Event with the right type works for the listener
    await act(async () => { document.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    await act(async () => { jest.advanceTimersByTime(10_000) })

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('DOES auto-navigate after 5 s if the user does nothing', async () => {
    await act(async () => { render(<AddItemPage />) })
    // Confirm setTimeout fires the navigation
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
    await act(async () => { await capturedOnAdd!(NEW_ITEM, false) })
    // setTimeout should have been called with a 5000ms delay
    const navCall = setTimeoutSpy.mock.calls.find(call => call[1] === 5000)
    expect(navCall).toBeDefined()

    await act(async () => { jest.advanceTimersByTime(5000) })

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/alice/book')
  })
})

// ── Suite: device-lock / PWA visibility (#145) ────────────────────────────────
//
// On a shared tablet in PWA standalone mode, the JS timer is suspended when
// the device is locked. It fires the instant the screen is unlocked — before
// the next user can touch anything to cancel it.
//
// Expected fix: listen to `visibilitychange` and cancel the timer when the
// page becomes hidden.

describe('AddItemPage — auto-navigate device-lock (#145)', () => {
  afterEach(() => {
    // Restore visibilityState to its jsdom default
    setVisibilityState('visible')
  })

  it('cancels the timer when the page becomes hidden (device locked) — EXPECTED TO FAIL before fix', async () => {
    await act(async () => { render(<AddItemPage />) })
    await act(async () => { await capturedOnAdd!(NEW_ITEM, false) })

    // Simulate device screen lock
    setVisibilityState('hidden')
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })

    // Advance past the 5 s window — timer should have been cancelled on hide
    await act(async () => { jest.advanceTimersByTime(10_000) })

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('does NOT fire when the page returns from background without a user interaction — EXPECTED TO FAIL before fix', async () => {
    await act(async () => { render(<AddItemPage />) })
    await act(async () => { await capturedOnAdd!(NEW_ITEM, false) })

    // Lock then immediately unlock (no pointerdown / keydown between)
    setVisibilityState('hidden')
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    setVisibilityState('visible')
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })

    await act(async () => { jest.advanceTimersByTime(10_000) })

    // This currently FAILS — the timer fires and navigateTo is called
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('still fires normally when the page stays visible throughout (regression guard)', async () => {
    await act(async () => { render(<AddItemPage />) })
    await act(async () => { await capturedOnAdd!(NEW_ITEM, false) })

    // No visibility change — page stays visible, user does nothing
    await act(async () => { jest.advanceTimersByTime(5_000) })

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/alice/book')
  })
})
