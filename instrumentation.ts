/**
 * Next.js instrumentation hook — runs once on server startup. Used to spin up
 * MSW (Mock Service Worker) when running Playwright e2e tests so that
 * server-side Supabase calls are intercepted with fixture data.
 *
 * Activated only when PLAYWRIGHT_TEST=1, set by playwright.config.ts.
 * Production builds skip this entirely.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.PLAYWRIGHT_TEST === '1') {
    const { server } = await import('./mocks/server')
    server.listen({ onUnhandledRequest: 'bypass' })
    // eslint-disable-next-line no-console
    console.log('[instrumentation] MSW server started for Playwright tests')
  }
}
