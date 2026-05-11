/**
 * Step definitions shared across feature files.
 * Specific scenarios pull these phrases for auth, navigation, and basic UI gestures.
 */
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { setSession } from '../../helpers'

const { Given, When, Then } = createBdd()

// ─── Authentication ─────────────────────────────────────────────────────────

Given('I am authenticated as an editor', async ({ context }) => {
  await setSession(context, { role: 'editor' })
})

Given('I am authenticated as a viewer', async ({ context }) => {
  await setSession(context, { role: 'viewer' })
})

// ─── Navigation ─────────────────────────────────────────────────────────────

When('I visit the login page', async ({ page }) => {
  await page.goto('/')
})

Given('I am on the login page', async ({ page }) => {
  await page.goto('/')
})

When('I visit the members page', async ({ page }) => {
  await page.goto('/members')
})

// ─── Basic gestures (reused by login + others) ──────────────────────────────

When('I enter the password {string}', async ({ page }, password: string) => {
  await page.getByPlaceholder(/password|pin/i).fill(password)
})

When('I press the {string} button', async ({ page }, label: string) => {
  await page.getByRole('button', { name: new RegExp(label, 'i') }).click()
})

// ─── Common assertions ──────────────────────────────────────────────────────

Then('I stay on the login screen', async ({ page }) => {
  // Wait for the password field to be visible — Playwright retries this until
  // the UI has settled after the failed login attempt, replacing a fixed sleep.
  await expect(page.getByPlaceholder(/password|pin/i)).toBeVisible()
  await expect(page).not.toHaveURL(/\/members/)
})

Then('I see the password field', async ({ page }) => {
  await expect(page.getByPlaceholder(/password|pin/i)).toBeVisible()
})

Then('I see the {string} button', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible()
})
