import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

/**
 * Playwright e2e tests — driven by Gherkin .feature files via playwright-bdd.
 *
 * Usage:
 *   npm run test:e2e          run all BDD scenarios
 *   npm run test:e2e:ui       open Playwright UI
 *   npm run test:e2e:headed   run with browser windows visible
 *
 * Feature files live in e2e/features/*.feature and are paired with step
 * definitions in e2e/features/steps/*.ts. Tests are runtime-generated under
 * .features-gen/ (gitignored) by `bddgen` before each `playwright test` invocation.
 *
 * Stack-portable by design: the .feature files describe behaviour without
 * implementation detail; if we ever migrate off Next.js/Playwright the
 * scenarios survive — only the step definitions need rewriting.
 */
const testDir = defineBddConfig({
  features: 'e2e/features/*.feature',
  steps:    'e2e/features/steps/*.ts',
})

export default defineConfig({
  testDir,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    serviceWorkers: 'block',
  },

  projects: [
    { name: 'chromium-desktop',  use: { ...devices['Desktop Chrome']    } },
    // iPhone 12 mini WebKit — the device that surfaced #118 originally
    { name: 'mobile-safari-mini', use: { ...devices['iPhone 12 Mini']   } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'playwright-smoke-test-secret-at-least-32chars-long',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-role',
      INITIAL_VIEW_PIN: process.env.INITIAL_VIEW_PIN ?? '1234',
      INITIAL_FAMILY_PASSWORD: process.env.INITIAL_FAMILY_PASSWORD ?? 'playwright',
      PLAYWRIGHT_TEST: '1',
    },
  },
})
