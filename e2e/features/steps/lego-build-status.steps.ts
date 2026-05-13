/**
 * Step definitions for lego-build-status.feature.
 *
 * "Given I am logged in as an editor" and "Given I am logged in as a viewer"
 * are defined in item-detail-sheet.steps.ts to avoid duplicate-step errors.
 * All steps here are unique to the Lego build-status feature.
 */
import { expect } from '@playwright/test'
import { createBdd, DataTable } from 'playwright-bdd'
import { createTestItem, mockItemMutations } from '../../helpers'

const { Given, When, Then, After } = createBdd()

// ─── Cleanup registry ────────────────────────────────────────────────────────

const cleanupFns: Array<() => Promise<void>> = []

After(async () => {
  for (const fn of cleanupFns.splice(0)) {
    try { await fn() } catch { /* best-effort */ }
  }
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
  const { id, cleanup } = await createTestItem(page, {
    memberSlug: 'alice',
    collection: 'lego',
    title,
    lego_status: null,
  })
  cleanupFns.push(cleanup)
  // Pre-wire a mutation mock so status updates are reflected without a DB write
  await mockItemMutations(page, id, {
    id,
    title,
    collection: 'lego',
    lego_status: null,
    member_slug: 'alice',
  })
  await page.reload()
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).toBeVisible()
})

Given(
  'the Lego set {string} has build status {string}',
  async ({ page }, title: string, status: string) => {
    const dbStatus = STATUS_TO_DB[status] ?? status
    const { id, cleanup } = await createTestItem(page, {
      memberSlug: 'alice',
      collection: 'lego',
      title,
      lego_status: dbStatus,
    })
    cleanupFns.push(cleanup)
    await mockItemMutations(page, id, {
      id,
      title,
      collection: 'lego',
      lego_status: dbStatus,
      member_slug: 'alice',
    })
    await page.reload()
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
    ).toBeVisible()
  },
)

Given(
  'the Lego collection contains:',
  async ({ page }, table: DataTable) => {
    const rows = table.hashes() as Array<{ Set: string; Status: string }>
    for (const row of rows) {
      const dbStatus = STATUS_TO_DB[row.Status] ?? row.Status
      const { cleanup } = await createTestItem(page, {
        memberSlug: 'alice',
        collection: 'lego',
        title: row.Set,
        lego_status: dbStatus,
      })
      cleanupFns.push(cleanup)
    }
    await page.reload()
    // Wait until at least the first item is visible before continuing
    const firstTitle = rows[0].Set
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${firstTitle}`, 'i') }),
    ).toBeVisible()
  },
)

// ─── Opening the sheet (shared helper, keeps lego steps self-contained) ───────

async function openSheet(page: import('@playwright/test').Page, title: string) {
  const card = page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') })
  await expect(card).toBeVisible()
  await card.click()
  await expect(page.getByRole('button', { name: /✕ Close/i })).toBeVisible()
}

// Reuse the same phrase defined in item-detail-sheet.steps.ts — playwright-bdd
// resolves a step phrase to whichever file defines it; we MUST NOT re-declare it
// here.  The step is therefore covered by item-detail-sheet.steps.ts.
// However, the lego feature needs this step too.  playwright-bdd merges step
// registries across all files so the shared definition is picked up automatically.

// ─── Status buttons ───────────────────────────────────────────────────────────

When('I tap the {string} status button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click()
})

// ─── Assertions ───────────────────────────────────────────────────────────────

Then(
  'the build status badge on the item card updates to {string}',
  async ({ page }, label: string) => {
    // After closing the sheet the badge on the card should reflect the new status
    // Close the sheet first (if still open)
    const closeBtn = page.getByRole('button', { name: /✕ Close/i })
    if (await closeBtn.isVisible()) await closeBtn.click()
    await expect(page.getByText(label).first()).toBeVisible()
  },
)

Then('the build status badge shows {string}', async ({ page }, label: string) => {
  // Badge inside the open sheet
  await expect(page.getByText(label)).toBeVisible()
})

Then('the status buttons are not displayed', async ({ page }) => {
  await expect(page.getByRole('button', { name: /🔨 Built/i })).not.toBeVisible()
  await expect(page.getByRole('button', { name: /📦 In box/i })).not.toBeVisible()
  await expect(page.getByRole('button', { name: /🔧 Apart/i })).not.toBeVisible()
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
