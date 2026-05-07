/**
 * Step definitions for collection.feature — covers the #117 sidebar nav and
 * #118 toolbar overflow regression scenarios.
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

Given("I am on Alice's vinyl collection page", async ({ page }) => {
  await page.goto('/alice/vinyl')
})

When('I sort by title', async ({ page }) => {
  await page.locator('select').first().selectOption('title')
})

When('I click the first sidebar letter', async ({ page }) => {
  // Spy on scrollIntoView so we can assert the click really triggered a scroll.
  // Doing this in the step definition (rather than the .feature) keeps the
  // Gherkin scenario implementation-free.
  await page.evaluate(() => {
    const w = window as unknown as { __scrollCalls: number }
    w.__scrollCalls = 0
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (...args) {
      w.__scrollCalls += 1
      return original.apply(this, args as [ScrollIntoViewOptions?])
    }
  })

  // Single-letter sidebar buttons appear once a letter-grouped sort is active
  const sidebarButtons = page.locator('button').filter({ hasText: /^[A-Z#]$/ })
  await expect(sidebarButtons.first()).toBeVisible()
  await sidebarButtons.first().click()
})

Then('the page scrolls to a section', async ({ page }) => {
  const calls = await page.evaluate(() => (window as unknown as { __scrollCalls: number }).__scrollCalls)
  expect(calls).toBeGreaterThan(0)
})

Then('the sort dropdown is visible inside the viewport', async ({ page, viewport }) => {
  const sortSelect = page.locator('select').first()
  await expect(sortSelect).toBeVisible()
  const box = await sortSelect.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x + box!.width).toBeLessThanOrEqual((viewport?.width ?? 1280) + 1)
})

Then('the view-mode toggle is visible inside the viewport', async ({ page, viewport }) => {
  const toggle = page.getByRole('button', { name: /switch to (list|grid) view/i })
  await expect(toggle).toBeVisible()
  const box = await toggle.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x + box!.width).toBeLessThanOrEqual((viewport?.width ?? 1280) + 1)
})
