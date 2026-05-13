/**
 * Step definitions for item-detail-sheet.feature.
 *
 * Uses the MSW-based test architecture: fixture state is set via
 * /api/__test/fixtures (setFixtureState) before each navigation.
 * No real database writes happen.
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { setSession, setFixtureState } from '../../helpers'
import { FIXTURE_ITEMS } from '../../../mocks/fixtures'

const { Given, When, Then, Before } = createBdd()

// ─── Before hook ─────────────────────────────────────────────────────────────

Before(async ({ page, context }) => {
  // Set session first so the /api/__test/fixtures call is authenticated,
  // then reset MSW state to a clean baseline before every scenario.
  await setSession(context, { role: 'editor' })
  await setFixtureState(page, { action: 'reset' })
})

// ─── Authentication ──────────────────────────────────────────────────────────

Given('I am logged in', async ({ context }) => {
  await setSession(context, { role: 'editor' })
})

Given('I am logged in as a viewer', async ({ context, page }) => {
  await setSession(context, { role: 'viewer' })
  // Reload so SSR re-renders with the new session role.
  if (page.url() !== 'about:blank') await page.reload()
})

Given('I am logged in as an editor', async ({ context, page }) => {
  await setSession(context, { role: 'editor' })
  // Reload so SSR re-renders with the new session role.
  if (page.url() !== 'about:blank') await page.reload()
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
  async ({ page }, title: string, _creator: string) => {
    // The item must already exist in FIXTURE_ITEMS (e.g. 'Dark Side of the Moon').
    // State was reset in the Before hook, so it will be present.
    // Navigate to the collection page.
    await page.goto('/alice/vinyl')
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
    ).toBeVisible()
  },
)

Given(
  'the item {string} has the note {string}',
  async ({ page }, title: string, note: string) => {
    const item = FIXTURE_ITEMS.find(i => i.title === title)
    if (!item) throw new Error(`No fixture item with title "${title}"`)
    await setFixtureState(page, { action: 'patchItem', id: item.id, patch: { notes: note } })
    await page.goto('/alice/vinyl')
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
    ).toBeVisible()
  },
)

Given('the item {string} has no note', async ({ page }, title: string) => {
  const item = FIXTURE_ITEMS.find(i => i.title === title)
  if (!item) throw new Error(`No fixture item with title "${title}"`)
  await setFixtureState(page, { action: 'patchItem', id: item.id, patch: { notes: null } })
  await page.goto('/alice/vinyl')
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).toBeVisible()
})

Given('{string} is in the Owned tab', async ({ page }, title: string) => {
  const item = FIXTURE_ITEMS.find(i => i.title === title)
  if (!item) throw new Error(`No fixture item with title "${title}"`)
  await setFixtureState(page, { action: 'patchItem', id: item.id, patch: { is_wishlist: false } })
  await page.goto('/alice/vinyl')
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).toBeVisible()
})

Given(
  'the item {string} has year {string} and a cover image',
  async ({ page }, title: string, year: string) => {
    const item = FIXTURE_ITEMS.find(i => i.title === title)
    if (!item) throw new Error(`No fixture item with title "${title}"`)
    await setFixtureState(page, {
      action: 'patchItem',
      id: item.id,
      patch: { year: parseInt(year, 10), cover_path: 'covers/test.jpg' },
    })
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
    await page.goto('/alice/vinyl')
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
  // Background already navigated to the collection page.
  // If the item card is not yet visible, navigate first.
  const card = page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') })
  if (!(await card.isVisible())) {
    await page.goto('/alice/vinyl')
  }
  await openSheet(page, title)
})

// ─── Sheet assertions ─────────────────────────────────────────────────────────

Then('a detail sheet slides up from the bottom of the screen', async ({ page }) => {
  await expect(page.getByRole('button', { name: /✕ Close/i })).toBeVisible()
})

Then('the sheet displays the title {string}', async ({ page }, title: string) => {
  // Scope to the heading inside the dialog to avoid matching the card button text.
  await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible()
})

Then('the sheet displays the creator {string}', async ({ page }, creator: string) => {
  // Scope to the dialog element so we don't match text elsewhere on the page.
  await expect(page.locator('[role="dialog"]').getByText(creator).first()).toBeVisible()
})

Then('the sheet shows the year {string}', async ({ page }, year: string) => {
  await expect(page.getByText(year)).toBeVisible()
})

Then('the cover image is displayed at the top of the sheet', async ({ page }) => {
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
  // The Toast component renders a fixed-position div with animate-fade-in class.
  // It does NOT use role="status" — match by the animation class instead.
  await expect(page.locator('.animate-fade-in').first()).toBeVisible()
})

// ─── Wishlist toggle ──────────────────────────────────────────────────────────

Then('{string} no longer appears in the Owned tab', async ({ page }, title: string) => {
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).not.toBeVisible()
})

Then('{string} now appears in the Wishlist tab', async ({ page }, title: string) => {
  // The Owned/Wishlist toggle is a <button>, not a tab role.
  await page.getByRole('button', { name: /^Wishlist/i }).click()
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
