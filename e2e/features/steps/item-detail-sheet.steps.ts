/**
 * Step definitions for item-detail-sheet.feature.
 *
 * Test data is created in the real dev Supabase DB via POST /api/items and
 * cleaned up in an After hook. The cleanupFns array is populated by each
 * "Given the collection contains …" step and drained after every scenario.
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { setSession, createTestItem, mockItemMutations } from '../../helpers'

const { Given, When, Then, After } = createBdd()

// ─── Cleanup registry ────────────────────────────────────────────────────────

const cleanupFns: Array<() => Promise<void>> = []

After(async () => {
  for (const fn of cleanupFns.splice(0)) {
    try { await fn() } catch { /* best-effort */ }
  }
})

// ─── Authentication ──────────────────────────────────────────────────────────

Given('I am logged in', async ({ context }) => {
  await setSession(context, { role: 'editor' })
})

Given('I am logged in as a viewer', async ({ context }) => {
  await setSession(context, { role: 'viewer' })
})

Given('I am logged in as an editor', async ({ context }) => {
  await setSession(context, { role: 'editor' })
})

// ─── Navigation ──────────────────────────────────────────────────────────────

Given('I am viewing {string}\'s vinyl collection', async ({ page }, _member: string) => {
  // The feature always uses Alice — the slug is inferred from the member name.
  await page.goto('/alice/vinyl')
  await expect(page.locator('main')).toBeVisible()
})

Given('I am viewing a member\'s vinyl collection', async ({ page }) => {
  await page.goto('/alice/vinyl')
  await expect(page.locator('main')).toBeVisible()
})

// ─── Data setup helpers ───────────────────────────────────────────────────────

Given(
  'the collection contains the vinyl record {string} by {string}',
  async ({ page }, title: string, creator: string) => {
    const { cleanup } = await createTestItem(page, {
      memberSlug: 'alice',
      collection: 'vinyl',
      title,
      creator,
    })
    cleanupFns.push(cleanup)
    await page.reload()
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
    ).toBeVisible()
  },
)

Given(
  'the item {string} has the note {string}',
  async ({ page }, title: string, note: string) => {
    const { cleanup } = await createTestItem(page, {
      memberSlug: 'alice',
      collection: 'vinyl',
      title,
      notes: note,
    })
    cleanupFns.push(cleanup)
    await page.reload()
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
    ).toBeVisible()
  },
)

Given('the item {string} has no note', async ({ page }, title: string) => {
  const { cleanup } = await createTestItem(page, {
    memberSlug: 'alice',
    collection: 'vinyl',
    title,
    notes: null,
  })
  cleanupFns.push(cleanup)
  await page.reload()
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).toBeVisible()
})

Given('{string} is in the Owned tab', async ({ page }, title: string) => {
  const { id, cleanup } = await createTestItem(page, {
    memberSlug: 'alice',
    collection: 'vinyl',
    title,
    is_wishlist: false,
  })
  cleanupFns.push(cleanup)
  // Set up mutation mock so the PATCH succeeds without writing to the DB again
  await mockItemMutations(page, id, {
    id,
    title,
    collection: 'vinyl',
    is_wishlist: true,
    member_slug: 'alice',
  })
  await page.reload()
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).toBeVisible()
})

Given(
  'the item {string} has year {string} and a cover image',
  async ({ page }, title: string, year: string) => {
    const { cleanup } = await createTestItem(page, {
      memberSlug: 'alice',
      collection: 'vinyl',
      title,
      year: parseInt(year, 10),
    })
    cleanupFns.push(cleanup)
    // Intercept the cover image URL so it resolves without a real asset
    await page.route(/cover/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        ),
      })
    })
    await page.reload()
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
    ).toBeVisible()
  },
)

// ─── Opening the sheet ────────────────────────────────────────────────────────

async function openSheet(page: import('@playwright/test').Page, title: string) {
  const card = page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') })
  await expect(card).toBeVisible()
  await card.click()
  await expect(page.getByRole('button', { name: /✕ Close/i })).toBeVisible()
}

When('I tap the item card for {string}', async ({ page }, title: string) => {
  await openSheet(page, title)
})

When('I open the detail sheet for {string}', async ({ page }, title: string) => {
  await openSheet(page, title)
})

Given('the detail sheet for {string} is open', async ({ page }, title: string) => {
  // The Background navigates to the collection page.  Ensure the item exists
  // (created in a preceding step) and open its sheet.
  const card = page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') })
  if (!(await card.isVisible())) {
    // Create it on-the-fly if not already present from a previous Given step
    const { cleanup } = await createTestItem(page, {
      memberSlug: 'alice',
      collection: 'vinyl',
      title,
    })
    cleanupFns.push(cleanup)
    await page.reload()
  }
  await openSheet(page, title)
})

// ─── Sheet assertions ─────────────────────────────────────────────────────────

Then('a detail sheet slides up from the bottom of the screen', async ({ page }) => {
  await expect(page.getByRole('button', { name: /✕ Close/i })).toBeVisible()
})

Then('the sheet displays the title {string}', async ({ page }, title: string) => {
  // The sheet is the element that contains the close button — check for the
  // title text somewhere within the same section of the DOM.
  await expect(page.getByText(title)).toBeVisible()
})

Then('the sheet displays the creator {string}', async ({ page }, creator: string) => {
  await expect(page.getByText(creator)).toBeVisible()
})

Then('the sheet shows the year {string}', async ({ page }, year: string) => {
  await expect(page.getByText(year)).toBeVisible()
})

Then('the cover image is displayed at the top of the sheet', async ({ page }) => {
  // The sheet must contain at least one img element
  await expect(page.locator('dialog img, [role="dialog"] img').first()).toBeVisible()
})

Then('I see the note {string}', async ({ page }, note: string) => {
  await expect(page.getByText(note)).toBeVisible()
})

Then('I do not see a notes input field', async ({ page }) => {
  await expect(page.locator('textarea')).not.toBeVisible()
})

Then('I do not see an Edit button', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^edit/i })).not.toBeVisible()
})

Then('I do not see a Delete button', async ({ page }) => {
  await expect(page.getByRole('button', { name: /delete/i })).not.toBeVisible()
})

// ─── Closing the sheet ────────────────────────────────────────────────────────

When('I tap the close button in the sheet', async ({ page }) => {
  await page.getByRole('button', { name: /✕ Close/i }).click()
})

When('I tap outside the sheet on the backdrop overlay', async ({ page }) => {
  // Click the top-left corner of the viewport — outside the card which sits at
  // the bottom / centre of the screen.
  await page.mouse.click(10, 10)
})

Then('the detail sheet is dismissed', async ({ page }) => {
  await expect(page.getByRole('button', { name: /✕ Close/i })).not.toBeVisible()
})

Then('I am returned to the collection grid', async ({ page }) => {
  // At least one item card button should still be present in the DOM
  await expect(
    page.getByRole('button', { name: /^Open details for /i }).first(),
  ).toBeVisible()
})

// ─── Notes editing ────────────────────────────────────────────────────────────

When('I type {string} into the notes field', async ({ page }, text: string) => {
  await page.locator('textarea').fill(text)
})

// Generic tap-a-button step (used for "Save note", "Move to Wishlist", etc.)
When('I tap {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click()
})

Then('the note {string} is saved', async ({ page }, note: string) => {
  // After saving, the note text should appear in the sheet (either in the
  // textarea value or as a paragraph — either way getByText works).
  await expect(page.getByText(note)).toBeVisible()
})

Then('a success toast appears', async ({ page }) => {
  await expect(page.getByRole('status')).toBeVisible()
})

// ─── Wishlist toggle ──────────────────────────────────────────────────────────

Then('{string} no longer appears in the Owned tab', async ({ page }, title: string) => {
  // After moving to wishlist the item should have left the owned (default) tab
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).not.toBeVisible()
})

Then('{string} now appears in the Wishlist tab', async ({ page }, title: string) => {
  // Click the Wishlist tab then verify the card is there
  await page.getByRole('tab', { name: /wishlist/i }).click()
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).toBeVisible()
})

// ─── Delete flow ─────────────────────────────────────────────────────────────

When('I tap the Delete button', async ({ page }) => {
  await page.getByRole('button', { name: /^delete$/i }).click()
})

Then('a confirmation dialog appears asking {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text)).toBeVisible()
})

Then('the item is NOT yet deleted', async ({ page }) => {
  // The detail sheet is still open (close button still visible)
  await expect(page.getByRole('button', { name: /✕ Close/i })).toBeVisible()
})

When('I confirm the delete action', async ({ page }) => {
  await page.getByRole('button', { name: /yes, delete/i }).click()
})

Then('{string} is removed from the collection grid', async ({ page }, title: string) => {
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).not.toBeVisible()
})
