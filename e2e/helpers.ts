import { Page } from '@playwright/test'

/**
 * Reads the family password (editor PIN) from env. Falls back to the value the
 * app seeds with if `INITIAL_FAMILY_PASSWORD` isn't set.
 *
 * Set via `.env.local` or as a shell env when running tests:
 *   PLAYWRIGHT_FAMILY_PASSWORD=secret npm run test:e2e
 */
export function getFamilyPassword(): string | undefined {
  return process.env.PLAYWRIGHT_FAMILY_PASSWORD ?? process.env.INITIAL_FAMILY_PASSWORD
}

export function getViewPin(): string | undefined {
  return process.env.PLAYWRIGHT_VIEW_PIN ?? process.env.INITIAL_VIEW_PIN
}

/**
 * Logs in as editor via the family password. Returns true on success, false otherwise.
 * Tests calling this should `test.skip(!loggedIn, 'no credentials')` when it returns false.
 */
export async function loginAsEditor(page: Page): Promise<boolean> {
  const password = getFamilyPassword()
  if (!password) return false

  await page.goto('/')
  await page.getByPlaceholder(/password|pin/i).fill(password)
  await page.getByRole('button', { name: /enter|sign in|log in/i }).click()
  // Successful login redirects to /members
  try {
    await page.waitForURL(/\/members/, { timeout: 5000 })
    return true
  } catch {
    return false
  }
}
