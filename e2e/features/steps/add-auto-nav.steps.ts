/**
 * Step definitions for add-auto-nav.feature (#121).
 * Reuses the auth + lego-add-page steps from common.steps.ts + load-more.steps.ts.
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { mockSearch } from '../../helpers'

const { Given, When, Then } = createBdd()

const FALCON = {
  external_id: '75192-1',
  title: 'Millennium Falcon',
  creator: 'Star Wars',
  year: 2017,
  cover_url: null,
  source: 'rebrickable',
}

Given('the search results respond with one Falcon set', async ({ page }) => {
  await mockSearch(page, { 0: { results: [FALCON], hasMore: false } })
})

// `When I search for {string}` is defined in load-more.steps.ts and reused here.

When('I add the first search result', async ({ page }) => {
  // The Add button text is just "Add" (Wishlist is the secondary action)
  await page.getByRole('button', { name: /^Add$/ }).first().click()
  // Wait until the page resets (results cleared, query empty) — confirms POST succeeded
  await expect(page.getByPlaceholder(/search/i)).toHaveValue('')
})

When('I start typing a new search {string}', async ({ page }, query: string) => {
  // Use a real keypress so the document-level keydown listener fires —
  // .fill() bypasses input events that the cancel listener relies on.
  await page.getByPlaceholder(/search/i).click()
  await page.keyboard.type(query)
})

Then('I am still on the add page after {int} seconds', async ({ page }, seconds: number) => {
  await page.waitForTimeout(seconds * 1000)
  await expect(page).toHaveURL(/\/add$/)
})

Then('I am redirected to the collection page within {int} seconds', async ({ page }, seconds: number) => {
  await page.waitForURL(/\/alice\/lego$/, { timeout: seconds * 1000 })
})

// ── Device-lock / PWA background scenarios (#145) ────────────────────────────

Given(/the device is locked \(page visibility becomes "hidden"\)/, async ({ page }) => {
  await page.evaluate(() =>
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }),
  )
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
})

Then('the auto-navigate timer is cancelled', async ({ page }) => {
  // Wait 1 second — if the timer had not been cancelled it would still be running;
  // the real assertion is that we are still on the add page (checked in the next step).
  await page.waitForTimeout(1000)
  await expect(page).toHaveURL(/\/add$/)
})

Then('I am NOT redirected even after {int} seconds in the background', async ({ page }, seconds: number) => {
  await page.waitForTimeout(seconds * 1000)
  await expect(page).toHaveURL(/\/add$/)
})

Given(
  /the device is unlocked \(page visibility becomes "visible"\) without any touch or key interaction/,
  async ({ page }) => {
    await page.evaluate(() =>
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }),
    )
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  },
)

Then('I am NOT redirected to the collection page', async ({ page }) => {
  // Give the app a moment to (incorrectly) navigate if the bug is present, then assert.
  await page.waitForTimeout(1000)
  await expect(page).not.toHaveURL(/\/alice\/lego$/)
})

Given('the page remains visible throughout', async () => {
  // No-op: visibility stays at the browser default ('visible').
  // This step exists purely as readable Gherkin context.
})
