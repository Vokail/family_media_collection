import { test, expect } from '@playwright/test'
import { setSession, mockExistingItems, mockSearch } from './helpers'

/**
 * Playwright smoke tests — local-only, run before push.
 *
 * Strategy: tests are self-contained. They never hit real Supabase or external
 * APIs. They use a pre-baked iron-session cookie + Playwright route mocking to
 * stand in for the backend. This catches real browser bugs (responsive layout,
 * scroll, real fetch lifecycle) without flakiness from network/DB state.
 *
 * Limitation: pages that do server-side data fetching (e.g. /members and the
 * collection grid) need MSW-style server-side mocking which isn't set up yet.
 * Those tests are documented below but skipped — easy to enable later.
 */

// ─── Login (no creds, no DB) ────────────────────────────────────────────────

test.describe('Login page', () => {
  test('renders the password field and Enter button', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByPlaceholder(/password|pin/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /enter/i })).toBeVisible()
  })

  test('rejects an incorrect password (stays on login screen)', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder(/password|pin/i).fill('definitely-wrong')
    await page.getByRole('button', { name: /enter/i }).click()
    await page.waitForTimeout(1500)
    await expect(page).not.toHaveURL(/\/members/)
    await expect(page.getByPlaceholder(/password|pin/i)).toBeVisible()
  })
})

// ─── Add page: Load More auto-hides (#116) — fully mocked ───────────────────

test.describe('Add page — Load More auto-advance (#116)', () => {
  const FALCON_75192 = { external_id: '75192-1', title: 'Millennium Falcon', creator: 'Star Wars', year: 2017, cover_url: null, source: 'rebrickable' }
  const FALCON_75257 = { external_id: '75257-1', title: 'Millennium Falcon', creator: 'Star Wars', year: 2019, cover_url: null, source: 'rebrickable' }
  const FALCON_75375 = { external_id: '75375-1', title: 'Millennium Falcon', creator: 'Star Wars', year: 2024, cover_url: null, source: 'rebrickable' }

  test('Load More button disappears once all unique sets are loaded', async ({ page, context }) => {
    await setSession(context, { role: 'editor' })
    await mockExistingItems(page, [])
    await mockSearch(page, {
      // Initial search → 2 sets, hasMore=true
      0:  { results: [FALCON_75192, FALCON_75257], hasMore: true },
      // Page 2 → all dupes, hasMore=true (Rebrickable would do this for variants)
      20: { results: [FALCON_75192, FALCON_75257], hasMore: true },
      // Page 3 → 1 fresh + hasMore=false (the natural end)
      40: { results: [FALCON_75375], hasMore: false },
    })

    await page.goto('/alice/lego/add')

    // Search
    await page.getByPlaceholder(/search/i).fill('Falcon')
    await page.getByRole('button', { name: /search/i }).click()

    // Initial 2 results show, Load More visible
    await expect(page.getByText('Millennium Falcon').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /load more/i })).toBeVisible()

    // One press should auto-advance through the all-dupe page 2 to page 3,
    // add the new 75375 set, and hide the button (page 3 had hasMore=false).
    await page.getByRole('button', { name: /load more/i }).click()

    // 75375 is now visible; button is gone
    await expect(page.locator('text=Millennium Falcon')).toHaveCount(3, { timeout: 5000 })
    await expect(page.getByRole('button', { name: /load more/i })).not.toBeVisible()
  })

  test('Load More disappears even when API keeps saying hasMore=true with all-dupes', async ({ page, context }) => {
    await setSession(context, { role: 'editor' })
    await mockExistingItems(page, [])
    await mockSearch(page, {
      0:  { results: [FALCON_75192, FALCON_75257], hasMore: true },
      // Every subsequent page is dupes + hasMore=true (worst-case API behaviour)
      20: { results: [FALCON_75192, FALCON_75257], hasMore: true },
      40: { results: [FALCON_75192, FALCON_75257], hasMore: true },
      60: { results: [FALCON_75192, FALCON_75257], hasMore: true },
      80: { results: [FALCON_75192, FALCON_75257], hasMore: true },
      100:{ results: [FALCON_75192, FALCON_75257], hasMore: true },
    })

    await page.goto('/alice/lego/add')
    await page.getByPlaceholder(/search/i).fill('Falcon')
    await page.getByRole('button', { name: /search/i }).click()

    // Wait for results to render before assuming the Load More button exists
    await expect(page.getByText('Millennium Falcon').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /load more/i })).toBeVisible()
    await page.getByRole('button', { name: /load more/i }).click()

    // Loop exhausts MAX_ATTEMPTS without finding fresh items → button hides
    await expect(page.getByRole('button', { name: /load more/i })).not.toBeVisible({ timeout: 10000 })
  })
})

// ─── SSR pages mocked via MSW (started by instrumentation.ts) ───────────────

test.describe('Members page', () => {
  test('renders the four family members from MSW fixtures', async ({ page, context }) => {
    await setSession(context, { role: 'editor' })
    await page.goto('/members')
    // Each member name appears in their own card; use .first() since the activity
    // feed below also references members by name.
    await expect(page.getByText('Alice').first()).toBeVisible()
    await expect(page.getByText('Bob').first()).toBeVisible()
    await expect(page.getByText('Charlie').first()).toBeVisible()
    await expect(page.getByText('Dana').first()).toBeVisible()
  })
})

test.describe('Collection page — toolbar (#118)', () => {
  test('sort select and view toggle stay inside the viewport', async ({ page, context, viewport }) => {
    await setSession(context, { role: 'editor' })
    await page.goto('/alice/vinyl')

    const viewportWidth = viewport?.width ?? 1280

    const sortSelect = page.locator('select').first()
    const viewToggle = page.getByRole('button', { name: /switch to (list|grid) view/i })

    await expect(sortSelect).toBeVisible()
    await expect(viewToggle).toBeVisible()

    const sortBox = await sortSelect.boundingBox()
    const toggleBox = await viewToggle.boundingBox()
    expect(sortBox).not.toBeNull()
    expect(toggleBox).not.toBeNull()
    // Right edge of every control must be inside the viewport
    expect(sortBox!.x + sortBox!.width).toBeLessThanOrEqual(viewportWidth + 1)
    expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(viewportWidth + 1)
  })
})

test.describe('Collection page — sidebar nav (#117)', () => {
  test('clicking a sidebar letter triggers a smooth scroll', async ({ page, context }) => {
    await setSession(context, { role: 'editor' })
    await page.goto('/alice/vinyl')

    // Switch to title sort to render letter sections + the sidebar
    await page.locator('select').first().selectOption('title')

    // The sidebar appears as a column of single-letter buttons
    const sidebarButtons = page.locator('button').filter({ hasText: /^[A-Z#]$/ })
    const count = await sidebarButtons.count()
    expect(count).toBeGreaterThan(0)

    // Spy on scrollIntoView to make sure the click actually wires through
    await page.evaluate(() => {
      const w = window as unknown as { __scrolled: number }
      w.__scrolled = 0
      const original = Element.prototype.scrollIntoView
      Element.prototype.scrollIntoView = function (...args) {
        w.__scrolled += 1
        return original.apply(this, args as [ScrollIntoViewOptions?])
      }
    })

    await sidebarButtons.first().click()

    const calls = await page.evaluate(() => (window as unknown as { __scrolled: number }).__scrolled)
    expect(calls).toBeGreaterThan(0)
  })
})
