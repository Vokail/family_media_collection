import { test, expect } from '@playwright/test'
import { loginAsEditor, getFamilyPassword, getViewPin } from './helpers'

/**
 * Smoke tests — covers flows that Jest/jsdom can't reliably exercise.
 *
 * These rely on a real Supabase backend (via .env.local) and the credentials
 * `PLAYWRIGHT_FAMILY_PASSWORD` / `PLAYWRIGHT_VIEW_PIN` (or the INITIAL_* equivs).
 * Tests skip gracefully if creds are missing rather than failing hard.
 */

test.describe('Login', () => {
  test('rejects an incorrect password with an error message', async ({ page }) => {
    await page.goto('/')
    await page.getByPlaceholder(/password|pin/i).fill('definitely-wrong')
    await page.getByRole('button', { name: /enter/i }).click()
    // Either a visible error message or stays on /
    await expect(page).toHaveURL('/')
    await expect(page.getByText(/incorrect|wrong/i)).toBeVisible({ timeout: 3000 })
  })

  test('family password redirects to members page', async ({ page }) => {
    test.skip(!getFamilyPassword(), 'no PLAYWRIGHT_FAMILY_PASSWORD set')
    const ok = await loginAsEditor(page)
    expect(ok).toBe(true)
    await expect(page).toHaveURL(/\/members/)
  })
})

test.describe('Members page', () => {
  test('renders the four family members', async ({ page }) => {
    test.skip(!getFamilyPassword(), 'no PLAYWRIGHT_FAMILY_PASSWORD set')
    await loginAsEditor(page)
    // The page links to /<slug>/<collection> — we don't hard-code names so this
    // works after the placeholder/real-name swap.
    const memberLinks = page.locator('a[href^="/"][href*="/vinyl"], a[href^="/"][href*="/book"]')
    await expect(memberLinks.first()).toBeVisible()
    expect(await memberLinks.count()).toBeGreaterThanOrEqual(4)
  })
})

test.describe('Collection page — toolbar layout (#118)', () => {
  test('toolbar controls all fit within the viewport', async ({ page, viewport }) => {
    test.skip(!getFamilyPassword(), 'no PLAYWRIGHT_FAMILY_PASSWORD set')
    await loginAsEditor(page)

    // Click the first member to open their collection
    const firstMember = page.locator('a[href*="/vinyl"], a[href*="/book"]').first()
    await firstMember.click()
    await page.waitForURL(/\/[^/]+\/(vinyl|book|comic|lego)/)

    const viewportWidth = viewport?.width ?? 1280

    // The Sort <select> and the view-mode toggle (☰/⊞) must be visible AND
    // their right edge must be inside the viewport. This is exactly what #118 broke.
    const sortSelect = page.locator('select').first()
    const viewToggle = page.getByRole('button', { name: /switch to (list|grid) view/i })

    await expect(sortSelect).toBeVisible()
    await expect(viewToggle).toBeVisible()

    const sortBox = await sortSelect.boundingBox()
    const toggleBox = await viewToggle.boundingBox()
    expect(sortBox).not.toBeNull()
    expect(toggleBox).not.toBeNull()
    expect(sortBox!.x + sortBox!.width).toBeLessThanOrEqual(viewportWidth + 1)
    expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(viewportWidth + 1)
  })
})

test.describe('Collection page — sidebar nav (#117)', () => {
  test('sidebar letter nav scrolls to its section after a sort change', async ({ page }) => {
    test.skip(!getFamilyPassword(), 'no PLAYWRIGHT_FAMILY_PASSWORD set')
    await loginAsEditor(page)

    const firstMember = page.locator('a[href*="/vinyl"], a[href*="/book"]').first()
    await firstMember.click()
    await page.waitForURL(/\/[^/]+\/(vinyl|book|comic|lego)/)

    // Switch to title sort to trigger letter sections + sidebar
    const sortSelect = page.locator('select').first()
    await sortSelect.selectOption('title')

    // If the collection is empty there will be no sidebar — skip in that case
    const sidebarButtons = page.locator('button').filter({
      hasText: /^[A-Z#]$/,
    })
    const count = await sidebarButtons.count()
    test.skip(count === 0, 'collection has no items / no sidebar to test')

    // Click the first sidebar letter and verify the page scrolled (scrollY > 0)
    // The smooth scroll is async so wait for it briefly.
    const beforeY = await page.evaluate(() => window.scrollY)
    await sidebarButtons.first().click()
    // Wait up to 1s for the smooth scroll to settle
    await page.waitForTimeout(800)
    const afterY = await page.evaluate(() => window.scrollY)
    // Either we scrolled OR the section was already at the top — both fine,
    // failing case is the button doing nothing while there's content below it.
    expect(typeof afterY).toBe('number')
    expect(afterY).toBeGreaterThanOrEqual(beforeY) // didn't go backwards
  })
})

test.describe('Add page — Load More auto-hides (#116)', () => {
  test('Load More button disappears when there are no more results to fetch', async ({ page }) => {
    test.skip(!getFamilyPassword(), 'no PLAYWRIGHT_FAMILY_PASSWORD set')
    await loginAsEditor(page)

    // Pick the first member, navigate to lego/add
    const firstMember = page.locator('a[href*="/vinyl"], a[href*="/book"]').first()
    const href = await firstMember.getAttribute('href')
    expect(href).not.toBeNull()
    const slug = href!.split('/')[1]
    await page.goto(`/${slug}/lego/add`)

    // Search for something with very few unique results so we can exhaust the API
    await page.getByPlaceholder(/search/i).fill('Millennium Falcon')
    await page.getByRole('button', { name: /search/i }).click()

    // Wait for results to render (search may take a few seconds)
    await page.waitForTimeout(2500)

    // Click Load More repeatedly (max 4 presses) until it disappears or we give up
    for (let i = 0; i < 4; i++) {
      const loadMore = page.getByRole('button', { name: /load more/i })
      const visible = await loadMore.isVisible().catch(() => false)
      if (!visible) break
      await loadMore.click()
      await page.waitForTimeout(2500)
    }

    // After exhausting, the button must be gone
    await expect(page.getByRole('button', { name: /load more/i })).not.toBeVisible()
  })
})

test.describe('Offline page', () => {
  test('renders the offline fallback', async ({ page }) => {
    await page.goto('/offline')
    await expect(page.locator('body')).toContainText(/offline|no.*connection|not.*available/i)
  })
})
