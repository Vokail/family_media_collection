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

// ── #147 — Long-name header alignment ────────────────────────────────────────
//
// The collection page header is a single flex row:
//   [← Members]  [member name — flex-1 min-w-0 truncate]  [Stats]
//
// Without min-w-0 on the h1 the intrinsic text width overrides flex-shrink and
// can push the back button off-screen or wrap the row. We simulate a very long
// name via page.evaluate() so we don't need a real DB entry.

Given('I am on the collection page for a member with a very long name', async ({ page }) => {
  // Navigate to Alice's vinyl page (a real, seeded route) then overwrite the
  // h1 text with a very long name so CSS truncation behaviour is exercisable
  // without needing a separate DB record.
  await page.goto('/alice/vinyl')
  await page.evaluate(() => {
    const h1 = document.querySelector('h1')
    if (h1) h1.textContent = 'Bartholomew Fitzgerald-Cunningham The Third'
  })
})

Then('the "← Members" back button is visible in the header', async ({ page }) => {
  await expect(page.getByRole('link', { name: /← Members/i })).toBeVisible()
})

Then('the "Stats" link is visible in the header', async ({ page }) => {
  await expect(page.getByRole('link', { name: /Stats/i })).toBeVisible()
})

Then('neither is pushed off-screen by the member name', async ({ page }) => {
  const viewportWidth = page.viewportSize()?.width ?? 1280

  const backLink = page.getByRole('link', { name: /← Members/i })
  const statsLink = page.getByRole('link', { name: /Stats/i })

  const backBox  = await backLink.boundingBox()
  const statsBox = await statsLink.boundingBox()

  expect(backBox).not.toBeNull()
  expect(statsBox).not.toBeNull()

  // Both links must start at or after x=0 (not scrolled off the left edge)
  expect(backBox!.x).toBeGreaterThanOrEqual(0)
  expect(statsBox!.x).toBeGreaterThanOrEqual(0)

  // Both links must end before or at the right edge of the viewport
  expect(backBox!.x  + backBox!.width).toBeLessThanOrEqual(viewportWidth + 1)
  expect(statsBox!.x + statsBox!.width).toBeLessThanOrEqual(viewportWidth + 1)
})

Then(
  'the member name in the h1 is truncated with an ellipsis if it exceeds the available width',
  async ({ page }) => {
    const h1 = page.locator('h1')
    await expect(h1).toBeVisible()

    // Primary check: the h1 must carry Tailwind's `truncate` class, which sets
    // overflow:hidden, text-overflow:ellipsis and white-space:nowrap together.
    await expect(h1).toHaveClass(/truncate/)

    // Secondary check: computed style confirms the CSS is actually applied.
    const textOverflow = await h1.evaluate((el) =>
      window.getComputedStyle(el).textOverflow,
    )
    expect(textOverflow).toBe('ellipsis')
  },
)

Then('the header remains a single line', async ({ page }) => {
  const h1 = page.locator('h1')
  await expect(h1).toBeVisible()

  // A single-line h1 at default font size is typically 24–40 px tall. We use
  // 50 px as a generous threshold: anything taller means the text has wrapped.
  const box = await h1.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeLessThan(50)
})
