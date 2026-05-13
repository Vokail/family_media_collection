/**
 * Step definitions for members.feature.
 * Members + their item counts come from the MSW handlers (mocks/handlers.ts).
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

Then('I see the member {string}', async ({ page }, name: string) => {
  // Each member name appears in their card AND in the recent activity feed —
  // .first() is enough to assert that at least the card rendered.
  await expect(page.getByText(name).first()).toBeVisible()
})

// ── #146 — Single-collection layout ──────────────────────────────────────────
//
// These "setup" steps are intentionally no-ops: the DB must be seeded with the
// correct state before the test suite runs (e.g. Alice has vinyl-only, Bob has
// all four). The steps exist to make the Gherkin self-documenting; assertions
// in the Then/And steps will fail fast if the seed data does not match.

Given('Alice has only her vinyl collection enabled', async () => {
  // DB must be seeded so Alice has only the vinyl collection active.
  // No browser action required here — the subsequent navigation step loads
  // the page and the assertion steps will verify the state.
})

Given('Alice has only her vinyl and book collections enabled', async () => {
  // DB must be seeded so Alice has vinyl + book only.
})

Given('Alice has all four collections enabled', async () => {
  // DB must be seeded so Alice has all four collections active.
})

Then("Alice's card shows only the vinyl collection badge", async ({ page }) => {
  // Vinyl badge must be present
  await expect(page.getByText('🎵').first()).toBeVisible()
  // Other collection emojis must NOT appear anywhere on the page
  await expect(page.getByText('📚').first()).not.toBeVisible()
  await expect(page.getByText('🦸').first()).not.toBeVisible()
  await expect(page.getByText('🧱').first()).not.toBeVisible()
})

Then('the badge row is horizontally centred within the card', async ({ page }) => {
  // The badge row flex container must carry justify-center so a single badge
  // sits in the middle of the card rather than left-aligned.
  const badgeRow = page.locator('.flex-wrap.gap-3.justify-center').first()
  await expect(badgeRow).toBeVisible()
})

Then("Alice's card shows the vinyl and book badges", async ({ page }) => {
  await expect(page.getByText('🎵').first()).toBeVisible()
  await expect(page.getByText('📚').first()).toBeVisible()
})

Then("no comic or lego badge is visible on Alice's card", async ({ page }) => {
  await expect(page.getByText('🦸').first()).not.toBeVisible()
  await expect(page.getByText('🧱').first()).not.toBeVisible()
})

Then("Alice's card shows vinyl, book, comic, and lego badges", async ({ page }) => {
  await expect(page.getByText('🎵').first()).toBeVisible()
  await expect(page.getByText('📚').first()).toBeVisible()
  await expect(page.getByText('🦸').first()).toBeVisible()
  await expect(page.getByText('🧱').first()).toBeVisible()
})

// ── #148 — Equal-height cards ─────────────────────────────────────────────────

Given('Bob has all four collections enabled', async () => {
  // DB must be seeded so Bob has all four collections active.
})

When('I visit the members page on a 375px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/members')
})

Then("Alice's card and Bob's card are the same height", async ({ page }) => {
  // Grab the first two member cards. Cards are rendered as anchor or div
  // elements inside a grid; we target the direct grid children.
  // The grid wrapper is the parent of the individual cards — we take the first
  // two visible cards regardless of member order, so this works even if the
  // grid order changes. We compare heights within a 2px tolerance to account
  // for sub-pixel rounding differences across browsers.
  const cards = page.locator('[data-testid="member-card"], .member-card, a[href*="/"][href$="/vinyl"], a[href*="/"][href$="/book"]').or(
    // Fallback: pick all direct children of the grid container
    page.locator('.grid > *')
  )

  // Use a more reliable selector: any card-shaped link that leads to a member
  // collection. Fall back to the grid children approach.
  const gridChildren = page.locator('.grid > *')
  const count = await gridChildren.count()
  expect(count).toBeGreaterThanOrEqual(2)

  const firstBox  = await gridChildren.nth(0).boundingBox()
  const secondBox = await gridChildren.nth(1).boundingBox()

  expect(firstBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  expect(Math.abs(firstBox!.height - secondBox!.height)).toBeLessThanOrEqual(2)
})

Then('each collection badge shows the icon on top and the count directly below it', async ({ page }) => {
  // Each badge is a flex-col span containing [icon-span, count-span].
  // We verify at least one such badge exists and that it uses flex-col layout.
  const badgeSpans = page.locator('.flex-wrap span.flex-col')
  const badgeCount = await badgeSpans.count()
  expect(badgeCount).toBeGreaterThan(0)
  // Each matched span must be visible
  for (let i = 0; i < badgeCount; i++) {
    await expect(badgeSpans.nth(i)).toBeVisible()
  }
})

Then('both cards have the same badge-row height', async ({ page }) => {
  // Badge rows are the flex-wrap containers inside cards.
  const badgeRows = page.locator('.flex-wrap.gap-3')
  const count = await badgeRows.count()
  expect(count).toBeGreaterThanOrEqual(2)

  const firstBox  = await badgeRows.nth(0).boundingBox()
  const secondBox = await badgeRows.nth(1).boundingBox()

  expect(firstBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  // Heights should match within 2px (min-h-10 equalises the badge area)
  expect(Math.abs(firstBox!.height - secondBox!.height)).toBeLessThanOrEqual(2)
})

Then('neither card looks lopsided or broken', async ({ page }) => {
  // A zero-height badge row is the clearest sign of a broken layout.
  const badgeRows = page.locator('.flex-wrap.gap-3')
  const count = await badgeRows.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    const box = await badgeRows.nth(i).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThan(0)
  }
})
