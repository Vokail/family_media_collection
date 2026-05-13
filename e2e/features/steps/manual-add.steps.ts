/**
 * Step definitions for manual-add.feature (#132).
 * Tests the ManualEntryForm component in the context of the full add page.
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { mockExistingItems } from '../../helpers'

const { Given, When, Then } = createBdd()

// Navigate to the book add page and set up API mocks for the manual-add scenarios.
Given('I am on Alice\'s book add page', async ({ page }) => {
  await mockExistingItems(page)
  await page.route(/\/api\/items\/manual/, async route => {
    // ManualEntryForm POSTs as FormData (not JSON), so postDataJSON() would throw.
    // Return a fixed success payload — the tests only care that the toast appears.
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'new-manual', title: 'Test', creator: 'Test', collection: 'book', member_id: 'm-alice', is_wishlist: false, notes: null, year: null, cover_path: null }),
    })
  })
  await page.goto('/alice/book/add')
})

Then('I do not see the manual entry form', async ({ page }) => {
  // The title input only renders when the form is expanded.
  // Use exact:true so "Search by title or artist…" placeholder doesn't match.
  await expect(page.getByPlaceholder('Title', { exact: true })).not.toBeVisible()
})

When('I click {string}', async ({ page }, label: string) => {
  // Use plain string, not regex — special chars like "?" in "Not found? Add manually"
  // would be misinterpreted as regex quantifiers if wrapped in new RegExp(label).
  await page.getByRole('button', { name: label }).click()
})

Then('I see the manual entry form', async ({ page }) => {
  await expect(page.getByPlaceholder('Title', { exact: true })).toBeVisible()
})

When('I fill in the manual title {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder('Title', { exact: true }).fill(title)
})

When('I fill in the manual creator {string}', async ({ page }, creator: string) => {
  await page.getByPlaceholder('Creator').fill(creator)
})

When('I submit the manual form as {string}', async ({ page }, mode: string) => {
  if (mode === 'wishlist') {
    await page.getByRole('button', { name: /add to wishlist/i }).click()
  } else {
    await page.getByRole('button', { name: /add to collection/i }).click()
  }
})

Then('I see a success toast', async ({ page }) => {
  // The Toast component renders an element with role="status" or similar;
  // match the text that appears for a successful add.
  await expect(
    page.getByText(/added to (collection|wishlist)/i),
  ).toBeVisible({ timeout: 5000 })
})

Then('the manual submit buttons are disabled', async ({ page }) => {
  const addBtn = page.getByRole('button', { name: /add to collection/i })
  const wishBtn = page.getByRole('button', { name: /add to wishlist/i })
  await expect(addBtn).toBeDisabled()
  await expect(wishBtn).toBeDisabled()
})
