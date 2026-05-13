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

/**
 * Create a test item in the real DB and return its id + a cleanup fn.
 * Any extra fields (notes, condition, lego_status) are applied via a
 * follow-up PATCH so they survive even if POST doesn't accept them.
 */
export async function createTestItem(
  page: Page,
  data: {
    memberSlug: string
    collection: string
    title: string
    creator?: string
    year?: number | null
    is_wishlist?: boolean
    notes?: string | null
    condition?: string | null
    lego_status?: string | null
  },
): Promise<{ id: string; cleanup: () => Promise<void> }> {
  const res = await page.request.post('/api/items', {
    data: {
      memberSlug: data.memberSlug,
      collection: data.collection,
      title: data.title,
      creator: data.creator ?? '',
      year: data.year ?? null,
      cover_url: null,
      is_wishlist: data.is_wishlist ?? false,
    },
  })
  if (!res.ok()) throw new Error(`createTestItem failed: ${await res.text()}`)
  const item = await res.json() as { id: string }

  // Apply fields that aren't settable on creation
  const patch: Record<string, unknown> = {}
  if (data.notes !== undefined)       patch.notes = data.notes
  if (data.condition !== undefined)   patch.condition = data.condition
  if (data.lego_status !== undefined) patch.lego_status = data.lego_status
  if (Object.keys(patch).length) {
    await page.request.patch(`/api/items/${item.id}`, { data: patch })
  }

  return {
    id: item.id,
    cleanup: async () => { await page.request.delete(`/api/items/${item.id}`) },
  }
}

/**
 * Mock PATCH + DELETE for a specific item id, echoing back an updated item shape.
 * Unrelated methods are forwarded to the real network.
 */
export async function mockItemMutations(
  page: Page,
  itemId: string,
  updatedItem: Record<string, unknown>,
) {
  await page.route(new RegExp(`/api/items/${itemId}$`), async (route: Route) => {
    const method = route.request().method()
    if (method === 'PATCH') {
      const patch = route.request().postDataJSON() ?? {}
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...updatedItem, ...patch }),
      })
    } else if (method === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    } else {
      await route.continue()
    }
  })
}
