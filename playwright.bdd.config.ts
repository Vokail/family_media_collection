import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

/**
 * BDD experiment — runs the .feature files as Playwright tests.
 *
 * Usage:
 *   npm run test:e2e:bdd            run the BDD specs
 *
 * Sits alongside playwright.config.ts; the regular `npm run test:e2e` is
 * unaffected. If we like the readability we can fold these in; if not we drop
 * the directory and the dependency.
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

  projects: [{ name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      SESSION_SECRET: process.env.SESSION_SECRET ?? 'playwright-smoke-test-secret-at-least-32chars-long',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-service-role',
      INITIAL_VIEW_PIN: process.env.INITIAL_VIEW_PIN ?? '1234',
      INITIAL_FAMILY_PASSWORD: process.env.INITIAL_FAMILY_PASSWORD ?? 'playwright',
      PLAYWRIGHT_TEST: '1',
    },
  },
})
