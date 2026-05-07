/**
 * Step definitions for load-more.feature.
 *
 * Each `Given/When/Then` phrase below maps to a Playwright snippet. The same
 * test fixtures (mocked /api/search via page.route, sealed iron-session cookie)
 * as the existing smoke.spec.ts, just expressed in BDD form.
 */
import { expect } from '@playwright/test'
import { createBdd, DataTable } from 'playwright-bdd'
import { mockExistingItems, mockSearch } from '../../helpers'

const { Given, When, Then } = createBdd()

const FALCONS: Record<string, { external_id: string; title: string; creator: string; year: number; cover_url: null; source: 'rebrickable' }> = {
  '75192-1': { external_id: '75192-1', title: 'Millennium Falcon', creator: 'Star Wars', year: 2017, cover_url: null, source: 'rebrickable' },
  '75257-1': { external_id: '75257-1', title: 'Millennium Falcon', creator: 'Star Wars', year: 2019, cover_url: null, source: 'rebrickable' },
  '75375-1': { external_id: '75375-1', title: 'Millennium Falcon', creator: 'Star Wars', year: 2024, cover_url: null, source: 'rebrickable' },
}

function expand(setList: string) {
  return setList.split(',').map(s => FALCONS[s.trim()]).filter(Boolean)
}

Given('I am on the Lego add page', async ({ page }) => {
  await mockExistingItems(page, [])
  await page.goto('/alice/lego/add')
})

Given('the search results respond with:', async ({ page }, table: DataTable) => {
  // Each row of the table becomes one offset → response mapping
  const responses: Record<number, unknown> = {}
  for (const row of table.hashes()) {
    const offset = parseInt(row.offset)
    const results = expand(row.sets)
    const hasMore = row.hasMore === 'true'
    responses[offset] = { results, hasMore }
  }
  await mockSearch(page, responses)
})

Given('the search results respond with all-dupe pages forever:', async ({ page }, table: DataTable) => {
  const setsRow = table.hashes()[0].sets
  const dupeResults = expand(setsRow)
  // Cover plenty of offsets so the auto-advance loop's MAX_ATTEMPTS exhausts
  const responses: Record<number, unknown> = {}
  for (let off = 0; off <= 100; off += 20) {
    responses[off] = { results: dupeResults, hasMore: true }
  }
  await mockSearch(page, responses)
})

When('I search for {string}', async ({ page }, query: string) => {
  await page.getByPlaceholder(/search/i).fill(query)
  await page.getByRole('button', { name: /search/i }).click()
  // Wait for the initial render so the Load More button can attach
  await expect(page.getByText('Millennium Falcon').first()).toBeVisible()
})

When('I press the Load More button', async ({ page }) => {
  await page.getByRole('button', { name: /load more/i }).click()
})

Then('I see {int} search result items', async ({ page }, count: number) => {
  // The mocked search returns N "Millennium Falcon" entries; counting that text
  // is the simplest way to assert the displayed result count from outside.
  await expect(page.locator('text=Millennium Falcon')).toHaveCount(count, { timeout: 5000 })
})

Then('the Load More button is hidden', async ({ page }) => {
  await expect(page.getByRole('button', { name: /load more/i })).not.toBeVisible()
})
