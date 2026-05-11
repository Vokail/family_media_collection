/**
 * Step definitions for manual-add.feature (#132).
 * Tests the ManualEntryForm component in the context of the full add page.
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { mockExistingItems } from '../../helpers'

const { Given, When, Then } = createBdd()

// "I am on Alice's {word} collection page" is in collection.steps.ts — reused here.
// We still need to navigate to the add sub-page.
Given('I am on Alice\'s book collection page', async ({ page }) => {
  await mockExistingItems(page)
  await page.route(/\/api\/items\/manual/, async route => {
    const body = route.request().postDataJSON?.() ?? {}
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'new-manual', title: body.title ?? '', creator: body.creator ?? '', is_wishlist: body.is_wishlist === 'true' }),
    })
  })
  await page.goto('/alice/book/add')
})

Then('I do not see the manual entry form', async ({ page }) => {
  // The title input only renders when the form is expanded
  await expect(page.getByPlaceholder('Title')).not.toBeVisible()
})

When('I click {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: new RegExp(label, 'i') }).click()
})

Then('I see the manual entry form', async ({ page }) => {
  await expect(page.getByPlaceholder('Title')).toBeVisible()
})

When('I fill in the manual title {string}', async ({ page }, title: string) => {
  await page.getByPlaceholder('Title').fill(title)
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
