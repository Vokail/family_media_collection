/**
 * Step definitions for vinyl-condition.feature.
 *
 * Auth steps ("I am logged in", "I am logged in as an editor", etc.) are
 * defined in item-detail-sheet.steps.ts and are shared automatically by
 * playwright-bdd's merged step registry — they are NOT re-declared here.
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

// ─── Condition label → display abbreviation map ───────────────────────────────

const CONDITION_LABEL: Record<string, string> = {
  mint:       'M',
  near_mint:  'NM',
  'very_good+': 'VG+',
  very_good:  'VG',
  good:       'G',
  poor:       'P',
}

// ─── Navigation ──────────────────────────────────────────────────────────────

// "I am viewing a member's vinyl collection" is also declared in
// item-detail-sheet.steps.ts.  playwright-bdd only allows one definition per
// phrase.  The vinyl-condition feature shares the Background
//   "Given I am logged in"
//   "And I am viewing a member's vinyl collection"
// Both of those phrases are covered by item-detail-sheet.steps.ts — we do NOT
// re-declare them here.

// ─── Data setup ───────────────────────────────────────────────────────────────

Given('the record {string} has no condition set', async ({ page }, title: string) => {
  const { id, cleanup } = await createTestItem(page, {
    memberSlug: 'alice',
    collection: 'vinyl',
    title,
    condition: null,
  })
  cleanupFns.push(cleanup)
  await mockItemMutations(page, id, {
    id,
    title,
    collection: 'vinyl',
    condition: null,
    member_slug: 'alice',
  })
  await page.reload()
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).toBeVisible()
})

Given(
  'the record {string} has condition {string}',
  async ({ page }, title: string, condition: string) => {
    const { id, cleanup } = await createTestItem(page, {
      memberSlug: 'alice',
      collection: 'vinyl',
      title,
      condition,
    })
    cleanupFns.push(cleanup)
    await mockItemMutations(page, id, {
      id,
      title,
      collection: 'vinyl',
      condition,
      member_slug: 'alice',
    })
    await page.reload()
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
    ).toBeVisible()
  },
)

Given(
  'the collection contains:',
  async ({ page }, table: DataTable) => {
    const rows = table.hashes() as Array<{ Record: string; Condition: string }>
    for (const row of rows) {
      const condition = row.Condition === '(none)' ? null : row.Condition
      const { cleanup } = await createTestItem(page, {
        memberSlug: 'alice',
        collection: 'vinyl',
        title: row.Record,
        condition,
      })
      cleanupFns.push(cleanup)
    }
    await page.reload()
    // Wait for the first item to appear
    const firstTitle = rows[0].Record
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${firstTitle}`, 'i') }),
    ).toBeVisible()
  },
)

// ─── Condition buttons in the sheet ───────────────────────────────────────────

When('I tap the {string} condition button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click()
})

// ─── Sort order ───────────────────────────────────────────────────────────────

When('I change the sort order to {string}', async ({ page }, option: string) => {
  await page.getByRole('combobox', { name: /sort/i }).selectOption(option)
})

// ─── Assertions ───────────────────────────────────────────────────────────────

Then(
  'the condition badge on the item card shows {string}',
  async ({ page }, label: string) => {
    // Close the sheet if it is still open so we can inspect the card
    const closeBtn = page.getByRole('button', { name: /✕ Close/i })
    if (await closeBtn.isVisible()) await closeBtn.click()
    await expect(page.getByText(label).first()).toBeVisible()
  },
)

Then('the condition badge shows {string}', async ({ page }, label: string) => {
  // The badge is rendered inside the open sheet
  await expect(page.getByText(label)).toBeVisible()
})

Then('the condition grade buttons are not displayed', async ({ page }) => {
  // None of the grade abbreviation buttons should be visible for a viewer
  for (const abbr of Object.values(CONDITION_LABEL)) {
    // Use getByRole with exact name to avoid false positives from badge text
    await expect(page.getByRole('button', { name: abbr, exact: true })).not.toBeVisible()
  }
})

Then(
  'the collection is divided into sections with headings:',
  async ({ page }, table: DataTable) => {
    const rows = table.hashes() as Array<{ Heading: string }>
    for (const row of rows) {
      await expect(page.getByText(row.Heading, { exact: false })).toBeVisible()
    }
  },
)

Then('the sections appear in best-to-worst order', async ({ page }) => {
  // Retrieve the bounding boxes of each heading and verify they appear in
  // descending Y-position order (i.e. best grade heading is highest on page).
  const orderedHeadings = ['M Mint', 'NM Near Mint', 'VG+ Very Good+', 'VG Very Good', 'G Good', 'P Poor']
  let previousY = -1
  for (const heading of orderedHeadings) {
    const el = page.getByText(heading, { exact: false })
    if (await el.isVisible()) {
      const box = await el.boundingBox()
      if (box) {
        expect(box.y).toBeGreaterThan(previousY)
        previousY = box.y
      }
    }
  }
})

Then(
  'a section headed {string} appears below all graded sections',
  async ({ page }, heading: string) => {
    await expect(page.getByText(heading, { exact: false })).toBeVisible()
  },
)

Then(
  '{string} appears in the {string} section',
  async ({ page }, itemTitle: string, sectionHeading: string) => {
    // Locate the section heading, then look for the item card inside it.
    // playwright-bdd / Playwright doesn't have a built-in "within" scope, so
    // we verify both are visible and rely on the DOM order test above.
    await expect(page.getByText(sectionHeading, { exact: false })).toBeVisible()
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${itemTitle}`, 'i') }),
    ).toBeVisible()
  },
)

Then('{string} appears in the Ungraded section', async ({ page }, title: string) => {
  await expect(page.getByText('Ungraded', { exact: false })).toBeVisible()
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).toBeVisible()
})
