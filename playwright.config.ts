import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright e2e smoke tests — local-only, run before push.
 *
 * Usage:
 *   npm run test:e2e          run all smoke tests headlessly
 *   npm run test:e2e:ui       open Playwright UI for debugging
 *   npm run test:e2e:headed   run with browser windows visible
 *
 * The tests use the existing dev server (auto-started via `webServer` below)
 * and rely on `.env.local` for Supabase + INITIAL_VIEW_PIN / INITIAL_FAMILY_PASSWORD.
 *
 * Tests are intentionally read-mostly; any writes must clean up after themselves.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,            // single user → keep tests sequential to avoid session collisions
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },

  projects: [
    // Desktop Chromium for everyday flows
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    // iPhone 12 mini viewport — the device that surfaced #118
    {
      name: 'mobile-safari-mini',
      use: { ...devices['iPhone 12 Mini'] },
    },
  ],

  // Spin up `npm run dev` automatically; reuse if it's already running locally.
  // Provides stub env vars so the middleware/Supabase clients don't crash on boot
  // when no .env.local exists. Any real value already in process.env (loaded from
  // .env.local by Next.js when the user runs the dev server themselves) takes
  // precedence in those manual flows.
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
    },
  },
})
