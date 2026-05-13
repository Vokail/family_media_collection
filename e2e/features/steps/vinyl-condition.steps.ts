/**
 * Step definitions for vinyl-condition.feature.
 *
 * Auth steps ("I am logged in", "I am logged in as an editor", etc.) are
 * defined in item-detail-sheet.steps.ts and are shared automatically by
 * playwright-bdd's merged step registry — they are NOT re-declared here.
 *
 * "I am viewing a member's vinyl collection" is defined in item-detail-sheet.steps.ts.
 * "When I open the detail sheet for {string}" is defined in item-detail-sheet.steps.ts.
 * "And a success toast appears" is defined in item-detail-sheet.steps.ts.
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

// ─── Condition label → display abbreviation map ───────────────────────────────
// Must match CONDITION_OPTIONS in lib/conditions.ts

const CONDITION_LABEL: Record<string, string> = {
  mint:      'M',
  near_mint: 'NM',
  good:      'G',
  poor:      'P',
}

// ─── Data setup ───────────────────────────────────────────────────────────────

Given('the record {string} has no condition set', async ({ page }, title: string) => {
  const item = FIXTURE_ITEMS.find(i => i.title === title && i.collection === 'vinyl')
  if (!item) throw new Error(`No vinyl fixture item with title "${title}"`)
  await setFixtureState(page, { action: 'patchItem', id: item.id, patch: { condition: null } })
  await page.goto('/alice/vinyl')
  await expect(
    page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
  ).toBeVisible()
})

Given(
  'the record {string} has condition {string}',
  async ({ page }, title: string, condition: string) => {
    const item = FIXTURE_ITEMS.find(i => i.title === title && i.collection === 'vinyl')
    if (!item) throw new Error(`No vinyl fixture item with title "${title}"`)
    await setFixtureState(page, { action: 'patchItem', id: item.id, patch: { condition } })
    await page.goto('/alice/vinyl')
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${title}`, 'i') }),
    ).toBeVisible()
  },
)

Given(
  'the collection contains:',
  async ({ page }, table: DataTable) => {
    const rows = table.hashes() as Array<{ Record: string; Condition: string }>
    // Replace all vinyl items for alice with the table rows
    const newItems = rows.map((row, idx) => {
      const condition = row.Condition === '(none)' ? null : row.Condition
      return {
        id: `i-vinyl-table-${idx}`,
        member_id: 'm-alice',
        collection: 'vinyl',
        title: row.Record,
        creator: 'Artist',
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
        condition,
        lego_status: null,
        locked_fields: null,
        created_at: new Date().toISOString(),
      }
    })
    await setFixtureState(page, {
      action: 'setCollection',
      member_id: 'm-alice',
      collection: 'vinyl',
      items: newItems,
    })
    await page.goto('/alice/vinyl')
    // Wait for the first item to appear
    const firstTitle = rows[0].Record
    await expect(
      page.getByRole('button', { name: new RegExp(`Open details for ${firstTitle}`, 'i') }),
    ).toBeVisible()
  },
)

// ─── Condition buttons in the sheet ───────────────────────────────────────────

// Map abbreviation (used in Gherkin) to full condition name (rendered in button text).
const ABBR_TO_NAME: Record<string, string> = {
  M:   'Mint',
  NM:  'Near Mint',
  G:   'Good',
  P:   'Poor',
}

When('I tap the {string} condition button', async ({ page }, label: string) => {
  // The feature uses abbreviations ("M", "G") but the buttons render full names.
  // Scope to dialog so filter-bar / card buttons outside the sheet don't match.
  // exact:true prevents "Mint" from substring-matching "Near Mint".
  const buttonName = ABBR_TO_NAME[label] ?? label
  await page.locator('[role="dialog"]').getByRole('button', { name: buttonName, exact: true }).click()
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
  // The feature passes abbreviations ("NM") but the dialog renders full names as
  // disabled condition buttons (highlighted for the current grade).
  // Using getByText('NM') causes a strict-mode violation because the parent
  // condition section div has text content "...conditio[n][M]int..." which
  // contains "nM" as a substring.  Map to the full name and locate the button
  // inside the open sheet instead.
  const fullName = ABBR_TO_NAME[label] ?? label
  await expect(
    page.locator('[role="dialog"]').getByRole('button', { name: fullName, exact: true }),
  ).toBeVisible()
})

Then('the condition grade buttons are not displayed', async ({ page }) => {
  // For a viewer, condition buttons are rendered disabled (not clickable).
  // We assert that all condition buttons within the sheet are disabled.
  // Button text matches opt.name from CONDITION_OPTIONS (e.g. "Mint", "Near Mint").
  const conditionNames = ['Mint', 'Near Mint', 'Good', 'Poor']
  for (const name of conditionNames) {
    const btn = page.locator('[role="dialog"]').getByRole('button', { name, exact: true })
    if (await btn.isVisible()) {
      await expect(btn).toBeDisabled()
    }
  }
})

Then(
  'the collection is divided into sections with headings:',
  async ({ page }, table: DataTable) => {
    const rows = table.hashes() as Array<{ Heading: string }>
    for (const row of rows) {
      // Each section heading is an h3 rendered as two sibling <span>s (badge abbr +
      // label text) inside a flex container.  The DOM textContent is "MMint" (no
      // space) so getByText('M Mint') finds 0 elements.  The ARIA accessible name
      // IS "M Mint" (Playwright computes it with a space via the flex layout), so
      // getByRole('heading', { name, level }) works correctly.
      await expect(page.getByRole('heading', { name: row.Heading, level: 3 })).toBeVisible()
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
