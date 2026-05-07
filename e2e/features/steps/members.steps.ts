/**
 * Step definitions for members.feature.
 * Members + their item counts come from the MSW handlers (mocks/handlers.ts).
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Then } = createBdd()

Then('I see the member {string}', async ({ page }, name: string) => {
  // Each member name appears in their card AND in the recent activity feed —
  // .first() is enough to assert that at least the card rendered.
  await expect(page.getByText(name).first()).toBeVisible()
})
