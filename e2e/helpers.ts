import { Page, BrowserContext, Route } from '@playwright/test'
import { sealData } from 'iron-session'

/**
 * The same SESSION_SECRET that playwright.config.ts injects into the dev server.
 * Both sides MUST use the same value or iron-session won't decrypt our cookie.
 */
const SESSION_PASSWORD = 'playwright-smoke-test-secret-at-least-32chars-long'

/**
 * Pre-bakes a valid iron-session cookie and attaches it to the browser context.
 * After this, any navigation to a protected route (e.g. /alice/lego/add) will
 * pass the middleware auth check without going through /api/auth.
 *
 * Use it instead of UI login when you don't want to test the login flow itself.
 */
export async function setSession(
  context: BrowserContext,
  session: { role: 'editor' | 'viewer' | 'member'; editableMemberId?: string },
) {
  const sealed = await sealData(session, { password: SESSION_PASSWORD })
  // Use `url` rather than `domain`/`path` — works more reliably across browsers
  // (WebKit is fussy about localhost cookies set via `domain: 'localhost'`).
  await context.addCookies([{
    name: 'fmc_session',
    value: sealed,
    url: 'http://localhost:3000',
    httpOnly: true,
    sameSite: 'Lax',
  }])
}

/**
 * Mocks the existing-items fetch (GET) AND the add-item call (POST) that the
 * add page makes. GET returns the supplied existing list; POST echoes back the
 * incoming body with an id, so the page can update its dedup map.
 */
export async function mockExistingItems(page: Page, items: unknown[] = []) {
  await page.route(/\/api\/items(\?|$)/, async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(items),
      })
    } else if (method === 'POST') {
      // Echo the posted body with a generated id — enough for the add page to
      // accept the response and trigger the post-add UI (toast + auto-navigate).
      const body = route.request().postDataJSON() ?? {}
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: `new-${Date.now()}`, ...body, member_id: 'm-alice' }),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Mocks /api/search responses by offset. Pass a map of `offset → response body`.
 * The body should be either an array (book/comic style) or `{ results, hasMore }`
 * (vinyl/lego style) — same as the real API.
 */
export async function mockSearch(
  page: Page,
  responsesByOffset: Record<number, unknown>,
) {
  await page.route(/\/api\/search(\?|$)/, async (route: Route) => {
    const url = new URL(route.request().url())
    const offset = parseInt(url.searchParams.get('offset') ?? '0')
    const body = responsesByOffset[offset] ?? { results: [], hasMore: false }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}
