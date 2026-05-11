/**
 * Step definitions for sort-name.feature (#120).
 * Reuses `Given I am on Alice's {word} collection page` from collection.steps.ts.
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import type { Route } from '@playwright/test'

const { Given, When, Then } = createBdd()

// Captured PATCH body — set in the "PATCH items API is mocked" step and
// read by the assertion step. Stored at module scope; safe because Playwright
// runs each scenario in its own page context.
let patchedBody: Record<string, unknown> | null = null

Given('the PATCH items API is mocked', async ({ page }) => {
  patchedBody = null
  await page.route(/\/api\/items\/[^/]+$/, async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      patchedBody = route.request().postDataJSON() ?? {}
      // Echo back the item with the patched fields applied
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'i-1', sort_name: patchedBody?.sort_name ?? null }),
      })
    } else {
      await route.continue()
    }
  })
})

When('I open the first item', async ({ page }) => {
  // Each ItemCard tile is a button with aria-label "Open details for <title>"
  const tile = page.getByRole('button', { name: /^Open details for /i }).first()
  await expect(tile).toBeVisible()
  await tile.click()
  // Detail sheet should open — wait for the close button to appear
  await expect(page.getByRole('button', { name: /✕ Close/i })).toBeVisible()
})

When('I tap the edit button', async ({ page }) => {
  // The pencil button is absolutely positioned — force the click so Playwright
  // doesn't reject it for being partially obscured by sibling elements.
  const editBtn = page.getByTitle('Edit title & creator')
  await expect(editBtn).toBeVisible()
  await editBtn.click({ force: true })
  // Wait for the title input to confirm the edit form is now shown
  await expect(page.getByPlaceholder('Artist / Author')).toBeVisible()
})

Then('I see the sort name field', async ({ page }) => {
  await expect(page.getByPlaceholder(/sort name/i)).toBeVisible()
})

Then('I do not see the sort name field', async ({ page }) => {
  await expect(page.getByPlaceholder(/sort name/i)).not.toBeVisible()
})

When('I fill in the sort name {string}', async ({ page }, sortName: string) => {
  await page.getByPlaceholder(/sort name/i).fill(sortName)
})

When('I save the edit', async ({ page }) => {
  await page.getByRole('button', { name: /^save$/i }).click()
})

Then('the PATCH request includes sort name {string}', async ({}, sortName: string) => {
  expect(patchedBody).not.toBeNull()
  expect(patchedBody!.sort_name).toBe(sortName)
})
