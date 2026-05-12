/**
 * @jest-environment jsdom
 *
 * Tests for AddItemPage's 5-second auto-navigate timer:
 *
 * #121 — interaction cancellation: timer must be cancelled the moment the
 *   user starts typing or tapping, so they aren't yanked away mid-edit.
 *
 * #145 — device-lock / PWA visibility: timer must be cancelled when the page
 *   goes to background (device locked), so a new user picking up the device
 *   isn't yanked to an unexpected collection before they can interact.
 *
 * Timer lifecycle edge-cases: failed add, second-add window reset,
 *   "View collection" immediate nav, ManualEntryForm code-path.
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
jest.mock('@/components/ScanPicker',    () => ({ __esModule: true, default: () => null }))

// Capture the onAdd prop from SearchResults (rendered inside SearchPane) so
// the test can trigger a successful add without the full search → click round-trip.
type OnAdd = (result: { external_id: string; title: string; creator: string; year: number | null; cover_url: string | null }, isWishlist: boolean) => Promise<void>
let capturedOnAdd: OnAdd | null = null
jest.mock('@/components/SearchResults', () => ({
  __esModule: true,
  default: ({ onAdd }: { onAdd: OnAdd }) => {
    capturedOnAdd = onAdd
    return null
  },
}))

// Capture scheduleNav and goToCollection from ManualEntryForm so we can
// trigger the ManualEntryForm add-path and the "View collection" callback.
let capturedScheduleNav: (() => void) | null = null
let capturedGoToCollection: (() => void) | null = null
jest.mock('@/components/ManualEntryForm', () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: React.forwardRef(({ scheduleNav, goToCollection }: any, _ref: any) => {
    capturedScheduleNav = scheduleNav
    capturedGoToCollection = goToCollection
    return null
  }),
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
const ITEM_2    = { external_id: 'OL2W', title: 'Foundation', creator: 'Isaac Asimov', year: 1951, cover_url: null }
const navigateMock = navigateTo as jest.Mock

function mockFetchSuccess() {
  ;(fetch as jest.Mock).mockImplementation((_url: string, opts?: { method?: string }) => {
    if ((opts?.method ?? 'GET') === 'POST') {
      return Promise.resolve({ ok: true, json: async () => ({ id: 'new', ...NEW_ITEM, member_id: 'alice', collection: 'book', is_wishlist: false }) })
    }
    return Promise.resolve({ ok: true, json: async () => [] })
  })
}

function mockFetchFailPost() {
  ;(fetch as jest.Mock).mockImplementation((_url: string, opts?: { method?: string }) => {
    if ((opts?.method ?? 'GET') === 'POST') {
      return Promise.resolve({ ok: false })
    }
    return Promise.resolve({ ok: true, json: async () => [] })
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  navigateMock.mockReset()
  ;(fetch as jest.Mock).mockReset()
  mockFetchSuccess()
})

afterEach(() => {
  jest.useRealTimers()
  capturedOnAdd = null
  capturedScheduleNav = null
  capturedGoToCollection = null
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

// ── Suite: timer lifecycle edge cases ─────────────────────────────────────────

describe('AddItemPage — timer lifecycle edge cases', () => {
  it('does NOT schedule auto-navigate when the add request fails', async () => {
    mockFetchFailPost()
    await act(async () => { render(<AddItemPage />) })
    await act(async () => { await capturedOnAdd!(NEW_ITEM, false) })

    await act(async () => { jest.advanceTimersByTime(10_000) })

    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('second add within the 5-second window resets the countdown — fires once at T+8 not T+5', async () => {
    await act(async () => { render(<AddItemPage />) })

    // First add at T+0 → timer set for T+5
    await act(async () => { await capturedOnAdd!(NEW_ITEM, false) })

    // T+3: original timer still running, not yet fired
    await act(async () => { jest.advanceTimersByTime(3_000) })
    expect(navigateMock).not.toHaveBeenCalled()

    // Second add at T+3 → timer RESET to T+3+5 = T+8
    await act(async () => { await capturedOnAdd!(ITEM_2, false) })

    // T+5 (2s after second add): original timer would have fired — must NOT navigate
    await act(async () => { jest.advanceTimersByTime(2_000) })
    expect(navigateMock).not.toHaveBeenCalled()

    // T+8 (5s after second add): new timer fires — navigate exactly once
    await act(async () => { jest.advanceTimersByTime(3_000) })
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/alice/book')
  })

  it('"View collection" navigates immediately and cancels the pending timer', async () => {
    await act(async () => { render(<AddItemPage />) })
    await act(async () => { await capturedOnAdd!(NEW_ITEM, false) })

    // Simulate tapping "View collection" in the toast (same as goToCollection)
    await act(async () => { capturedGoToCollection!() })

    // Navigate called once, immediately
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/alice/book')

    // Original 5-second timer must be cancelled — no second call
    await act(async () => { jest.advanceTimersByTime(10_000) })
    expect(navigateMock).toHaveBeenCalledTimes(1)
  })

  it('ManualEntryForm add path schedules the same timer and navigates after 5 s', async () => {
    await act(async () => { render(<AddItemPage />) })
    expect(capturedScheduleNav).not.toBeNull()

    // Call scheduleNav as ManualEntryForm does after a successful manual add
    await act(async () => { capturedScheduleNav!() })

    await act(async () => { jest.advanceTimersByTime(5_000) })

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/alice/book')
  })
})
