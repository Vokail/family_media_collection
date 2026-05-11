/**
 * Step definitions for collection.feature — covers the #117 sidebar nav and
 * #118 toolbar overflow regression scenarios.
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

Given("I am on Alice's {word} collection page", async ({ page }, collection: string) => {
  await page.goto(`/alice/${collection}`)
})

When('I sort by title', async ({ page }) => {
  await page.getByRole('combobox', { name: /sort/i }).selectOption('title')
})

When('I sort by status', async ({ page }) => {
  await page.getByRole('combobox', { name: /sort/i }).selectOption('status')
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
  const sortSelect = page.getByRole('combobox', { name: /sort/i })
  await expect(sortSelect).toBeVisible()
  const box = await sortSelect.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x + box!.width).toBeLessThanOrEqual((viewport?.width ?? 1280) + 1)
})

// #119: the failure mode is the sort/toggle wrapping to a new line BELOW
// Owned/Wishlist on iPhone 12 mini for books/comics/lego. Asserting "fits in
// viewport" passes either way (wrap stays in-bounds), so we also check that
// the toggle is on the same horizontal line as the Owned tab — i.e. they share
// the same row in the flex container.
Then('the view-mode toggle is visible inside the viewport', async ({ page, viewport }) => {
  const toggle = page.getByRole('button', { name: /switch to (list|grid) view/i })
  await expect(toggle).toBeVisible()
  const toggleBox = await toggle.boundingBox()
  expect(toggleBox).not.toBeNull()
  expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual((viewport?.width ?? 1280) + 1)

  const ownedBtn = page.getByRole('button', { name: /^owned/i })
  const ownedBox = await ownedBtn.boundingBox()
  expect(ownedBox).not.toBeNull()
  // Same row: vertical centres within 8 px (button height ~28-36 px so 8 px is tight)
  const ownedCentre  = ownedBox!.y  + ownedBox!.height  / 2
  const toggleCentre = toggleBox!.y + toggleBox!.height / 2
  expect(Math.abs(toggleCentre - ownedCentre)).toBeLessThan(8)
})
