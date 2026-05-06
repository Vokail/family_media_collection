/**
 * @jest-environment jsdom
 *
 * Regression tests for #116 — Load More auto-advance through all-dupe pages.
 *
 * Scenario: searching Lego returns page 1 of results. Pressing Load More fetches
 * page 2, which is entirely composed of sets already shown (all dupes). The fix
 * makes loadMore silently advance to page 3 rather than forcing the user to press
 * Load More again just to confirm there are no new items.
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useParams: () => ({ member: 'alice', collection: 'lego' }),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
jest.mock('@/components/BarcodeScanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/PhotoCapture',   () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/SearchResults', () => ({
  __esModule: true,
  default: ({ results }: { results: Array<{ external_id: string; title: string }> }) => (
    <ul data-testid="results">
      {results.map(r => <li key={r.external_id} data-testid="result-item">{r.title}</li>)}
    </ul>
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

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

import AddItemPage from '@/app/[member]/[collection]/add/page'

const makeLegoResult = (id: string, title = `Set ${id}`) => ({
  external_id: id,
  title,
  creator: 'Star Wars',
  year: 2020,
  cover_url: null,
  source: 'rebrickable' as const,
})

// Builds a Rebrickable-style paginated API response
const apiPage = (results: ReturnType<typeof makeLegoResult>[], hasMore: boolean) =>
  ({ ok: true, json: async () => ({ results, hasMore }) })

beforeEach(() => {
  mockFetch.mockReset()
  // Default: existing-items fetch returns empty list
  mockFetch.mockResolvedValue({ ok: true, json: async () => [] })
  Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 })
})

/** Helper: trigger a search that seeds initial results + hasMore=true. */
async function searchAndSeedResults(initialResults: ReturnType<typeof makeLegoResult>[]) {
  // 1st call: existing-items fetch (fires on mount)
  // 2nd call: /api/search for the user query
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => [] })           // existing items
    .mockResolvedValueOnce(apiPage(initialResults, true))                 // search results

  await act(async () => { render(<AddItemPage />) })

  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText(/Search by title/i), { target: { value: 'Falcon' } })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
  })

  await waitFor(() => expect(screen.getByTestId('results')).toBeInTheDocument())
}

describe('AddItemPage Load More — auto-advance through all-dupe pages (#116)', () => {
  it('auto-fetches next page when entire page is all-dupes and hasMore=true, then shows new items', async () => {
    const initial   = [makeLegoResult('75192-1', 'Millennium Falcon'), makeLegoResult('75257-1', 'Falcon')]
    const dupePage  = initial // same items → all dupes
    const freshPage = [makeLegoResult('75375-1', 'New Falcon')]

    await searchAndSeedResults(initial)
    expect(screen.getAllByTestId('result-item')).toHaveLength(2)

    // Load More: page 2 = all dupes (hasMore=true) → auto-advance to page 3 = fresh
    mockFetch
      .mockResolvedValueOnce(apiPage(dupePage, true))  // offset 20 — all dupes
      .mockResolvedValueOnce(apiPage(freshPage, false)) // offset 40 — new item

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    })

    await waitFor(() => expect(screen.getAllByTestId('result-item')).toHaveLength(3))

    // Both pages were fetched in a single Load More press
    const searchCalls = mockFetch.mock.calls.filter(c => (c[0] as string).includes('/api/search'))
    expect(searchCalls.length).toBeGreaterThanOrEqual(2)

    // Button hidden because last page had hasMore=false
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
  })

  it('hides Load More button when all-dupe page has hasMore=false', async () => {
    const initial  = [makeLegoResult('75192-1'), makeLegoResult('75257-1')]
    const dupePage = initial // all dupes

    await searchAndSeedResults(initial)

    // Load More returns all dupes and no further pages
    mockFetch.mockResolvedValueOnce(apiPage(dupePage, false))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    })

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
    )
    // Result count unchanged (no new items were added)
    expect(screen.getAllByTestId('result-item')).toHaveLength(2)
  })

  it('hides Load More button when all pages are dupes even if apiHasMore stays true (#116)', async () => {
    // Regression: loop exited after MAX_ATTEMPTS without calling setHasMore(false),
    // so the button stayed visible forever when the API kept returning hasMore=true
    // but all results were already shown.
    const initial  = [makeLegoResult('75192-1'), makeLegoResult('75257-1')]
    const dupePage = initial // all dupes on every page

    await searchAndSeedResults(initial)

    // Every subsequent page returns dupes + hasMore=true (e.g. Rebrickable keeps paginating
    // through condition variants of the same sets)
    for (let i = 0; i < 6; i++) {
      mockFetch.mockResolvedValueOnce(apiPage(dupePage, true))
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    })

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
    )
    expect(screen.getAllByTestId('result-item')).toHaveLength(2)
  })

  it('shows Load More button when all fetched pages still have apiHasMore=true', async () => {
    // The loop fetches MAX_ATTEMPTS (5) pages per button press.
    // Button only stays visible when the LAST page fetched also has apiHasMore=true,
    // meaning there are genuinely more pages beyond what we checked.
    const initial = [makeLegoResult('75192-1')]
    await searchAndSeedResults(initial)

    // Mock all 5 pages of the loop, each with a unique fresh item and hasMore=true
    for (let i = 0; i < 5; i++) {
      mockFetch.mockResolvedValueOnce(apiPage([makeLegoResult(`new-${i}`, `Set ${i}`)], true))
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    })

    await waitFor(() => expect(screen.getAllByTestId('result-item')).toHaveLength(6)) // 1 + 5
    // Last page had hasMore=true — button must stay visible for the next batch
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument()
  })

  it('hides Load More button when 1 new item found and subsequent pages are all dupes (key regression)', async () => {
    // The scenario the user reported: search returns N sets, press Load More,
    // get 1 new set + button shows, press again, button goes away.
    // With the loop-all-pages approach, 1 press should find the item AND confirm
    // no more unique sets remain — button should be hidden in one press.
    const initial  = [makeLegoResult('75192-1', 'Millennium Falcon')]
    const withNew  = [makeLegoResult('75375-1', 'Millennium Falcon 2024')]
    const dupes    = initial // subsequent pages are all dupes

    await searchAndSeedResults(initial)

    // Page 1 of loop: 1 new item, hasMore=true
    // Pages 2-4: all dupes, hasMore=true
    // Page 5: all dupes, hasMore=false → loop stops, lastApiHasMore=false
    mockFetch
      .mockResolvedValueOnce(apiPage(withNew, true))   // 1 new item
      .mockResolvedValueOnce(apiPage(dupes,  true))    // all dupes
      .mockResolvedValueOnce(apiPage(dupes,  true))    // all dupes
      .mockResolvedValueOnce(apiPage(dupes,  true))    // all dupes
      .mockResolvedValueOnce(apiPage(dupes,  false))   // all dupes, no more pages

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /load more/i }))
    })

    await waitFor(() => expect(screen.getAllByTestId('result-item')).toHaveLength(2))
    // Button hidden — the loop confirmed no more unique items beyond the one we found
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
  })
})
