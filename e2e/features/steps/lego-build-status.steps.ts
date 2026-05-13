/**
 * Step definitions for lego-build-status.feature.
 *
 * "Given I am logged in as an editor" and "Given I am logged in as a viewer"
 * are defined in item-detail-sheet.steps.ts to avoid duplicate-step errors.
 * "When I open the detail sheet for {string}" is also defined there.
 * "And a success toast appears" is also defined there.
 * All steps here are unique to the Lego build-status feature.
 */
import { expect } from '@playwright/test'
import { createBdd, DataTable } from 'playwright-bdd'
import { setFixtureState } from '../../helpers'
import { FIXTURE_ITEMS } from '../../../mocks/fixtures'

const { Given, When, Then, Before } = createBdd()

// ─── Before hook ─────────────────────────────────────────────────────────────

Before(async ({ page }) => {
  await setFixtureState(page, { action: 'reset' })
})

// ─── Lego status label → DB value map ────────────────────────────────────────

const STATUS_TO_DB: Record<string, string> = {
  'Built':        'built',
  'In box':       'in_box',
  'Apart':        'disassembled',
  'built':        'built',
  'in_box':       'in_box',
  'disassembled': 'disassembled',
}

// ─── Navigation ──────────────────────────────────────────────────────────────

Given('I am viewing a member\'s Lego collection', async ({ page }) => {
  await page.goto('/alice/lego')
  await expect(page.locator('main')).toBeVisible()
})

// ─── Data setup ───────────────────────────────────────────────────────────────

Given('the Lego set {string} has no build status', async ({ page }, title: string) => {
  const item = FIXTURE_ITEMS.find(i => i.title === title && i.collection === 'lego')
  if (!item) throw new Error(`No lego fixture item with title "${title}"`)
  await setFixtureState(page, { action: 'patchItem', id: item.id, patch: { lego_status: null } })
  await page.goto('/alice/lego')
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).toBeVisible()
})

Given(
  'the Lego set {string} has build status {string}',
  async ({ page }, title: string, status: string) => {
    const item = FIXTURE_ITEMS.find(i => i.title === title && i.collection === 'lego')
    if (!item) throw new Error(`No lego fixture item with title "${title}"`)
    const dbStatus = STATUS_TO_DB[status] ?? status
    await setFixtureState(page, { action: 'patchItem', id: item.id, patch: { lego_status: dbStatus } })
    await page.goto('/alice/lego')
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
    ).toBeVisible()
  },
)

Given(
  'the Lego collection contains:',
  async ({ page }, table: DataTable) => {
    const rows = table.hashes() as Array<{ Set: string; Status: string }>
    // Replace all lego items for alice with the table rows
    const newItems = rows.map((row, idx) => {
      const dbStatus = STATUS_TO_DB[row.Status] ?? row.Status
      return {
        id: `i-lego-table-${idx}`,
        member_id: 'm-alice',
        collection: 'lego',
        title: row.Set,
        creator: 'Lego',
        year: 2020,
        cover_path: null,
        is_wishlist: false,
        notes: null,
        external_id: null,
        isbn: null,
        sort_name: null,
        rating: null,
        description: null,
        tracklist: null,
        status: null,
        genres: null,
        styles: null,
        condition: null,
        lego_status: dbStatus,
        locked_fields: null,
        created_at: new Date().toISOString(),
      }
    })
    await setFixtureState(page, {
      action: 'setCollection',
      member_id: 'm-alice',
      collection: 'lego',
      items: newItems,
    })
    await page.goto('/alice/lego')
    // Wait until at least the first item is visible before continuing
    const firstTitle = rows[0].Set
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${firstTitle}`, 'i') }),
    ).toBeVisible()
  },
)

// ─── Status buttons ───────────────────────────────────────────────────────────

When('I tap the {string} status button', async ({ page }, label: string) => {
  await page.locator('[role="dialog"]').getByRole('button', { name: label }).click()
})

// ─── Assertions ───────────────────────────────────────────────────────────────

Then(
  'the build status badge on the item card updates to {string}',
  async ({ page }, label: string) => {
    // After closing the sheet the badge on the card should reflect the new status
    const closeBtn = page.getByRole('button', { name: /✕ Close/i })
    if (await closeBtn.isVisible()) await closeBtn.click()
    await expect(page.getByText(label).first()).toBeVisible()
  },
)

Then('the build status badge shows {string}', async ({ page }, label: string) => {
  // Badge inside the open sheet — scope to dialog to avoid matching filter-bar buttons
  await expect(page.locator('[role="dialog"]').getByText(label).first()).toBeVisible()
})

Then('the status buttons are not displayed', async ({ page }) => {
  // Scope to the open sheet — filter-bar buttons outside the dialog should not
  // influence this assertion (they ARE visible on the page but belong to the grid).
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog.getByRole('button', { name: /🔨 Built/i })).not.toBeVisible()
  await expect(dialog.getByRole('button', { name: /📦 In box/i })).not.toBeVisible()
  await expect(dialog.getByRole('button', { name: /🔧 Apart/i })).not.toBeVisible()
})

// ─── Filter bar ───────────────────────────────────────────────────────────────

When(
  'I tap the {string} filter button above the grid',
  async ({ page }, label: string) => {
    await page.getByRole('button', { name: label }).click()
  },
)

Then(
  'only {string} is visible in the grid',
  async ({ page }, title: string) => {
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
    ).toBeVisible()
  },
)

Then('{string} is not visible', async ({ page }, title: string) => {
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).not.toBeVisible()
})
