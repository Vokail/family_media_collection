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
