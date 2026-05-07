/**
 * MSW request handlers — intercept the Supabase REST API calls made by the
 * server-side code (lib/db/* via createServerClient) so that pages can render
 * during Playwright tests without a real database.
 *
 * Supabase REST conventions used:
 *   GET  /rest/v1/<table>?select=*&<col>=eq.<val>&order=<col>.<asc|desc>
 *   POST /rest/v1/rpc/<fn>     (called by .rpc())
 *
 * The supabase-js client also adds an `Accept: application/vnd.pgrst.object+json`
 * header for `.single()` calls; we don't differentiate — we just return arrays
 * and supabase-js unwraps them. (For our handlers it doesn't matter — we always
 * return arrays.)
 *
 * Filters on query string: `?slug=eq.alice` becomes `slug=eq.alice` in the URL.
 * We parse `eq.<value>` only — that covers everything our app uses for SSR.
 */
import { http, HttpResponse } from 'msw'
import { FIXTURE_MEMBERS, FIXTURE_ITEMS } from './fixtures'

const SUPABASE_BASE = 'https://placeholder.supabase.co'

/** Reads `?col=eq.value` filters from the request URL. */
function parseEqFilters(url: URL): Record<string, string> {
  const filters: Record<string, string> = {}
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'select' || key === 'order' || key === 'limit') continue
    if (value.startsWith('eq.')) filters[key] = value.slice(3)
  }
  return filters
}

/** PostgREST returns a bare object (not wrapped in array) when `.single()` is
 *  used — that gets signalled via the `Accept: application/vnd.pgrst.object+json`
 *  header. supabase-js sets that header for `.single()` calls. */
function respondPostgrest(rows: unknown[], request: Request) {
  const accept = request.headers.get('accept') ?? ''
  if (accept.includes('vnd.pgrst.object+json')) {
    if (rows.length === 0) {
      return HttpResponse.json({ message: 'No rows found' }, { status: 406 })
    }
    return HttpResponse.json(rows[0])
  }
  return HttpResponse.json(rows)
}

export const handlers = [
  // ─── members ────────────────────────────────────────────────────────────────
  http.get(`${SUPABASE_BASE}/rest/v1/members`, ({ request }) => {
    const url = new URL(request.url)
    const filters = parseEqFilters(url)
    let rows = FIXTURE_MEMBERS as readonly Record<string, unknown>[]
    for (const [k, v] of Object.entries(filters)) {
      rows = rows.filter(r => String(r[k]) === v)
    }
    return respondPostgrest([...rows], request)
  }),

  // ─── items ──────────────────────────────────────────────────────────────────
  http.get(`${SUPABASE_BASE}/rest/v1/items`, ({ request }) => {
    const url = new URL(request.url)
    const filters = parseEqFilters(url)
    let rows = FIXTURE_ITEMS as readonly Record<string, unknown>[]
    for (const [k, v] of Object.entries(filters)) {
      // Convert "true"/"false" strings to booleans for is_wishlist
      const parsed = v === 'true' ? true : v === 'false' ? false : v
      rows = rows.filter(r => r[k] === parsed)
    }
    // listRecentActivity uses select=...,members(name,slug) — fake the join
    const select = url.searchParams.get('select') ?? ''
    if (select.includes('members(')) {
      rows = rows.map(r => ({
        ...r,
        members: FIXTURE_MEMBERS.find(m => m.id === r.member_id) ?? FIXTURE_MEMBERS[0],
      }))
    }
    return respondPostgrest([...rows], request)
  }),

  // ─── settings (used by the auth-throttling lockout check) ───────────────────
  http.get(`${SUPABASE_BASE}/rest/v1/settings`, ({ request }) => respondPostgrest([], request)),

  // ─── RPCs ───────────────────────────────────────────────────────────────────
  http.post(`${SUPABASE_BASE}/rest/v1/rpc/get_member_item_counts`, () => {
    // Build counts from FIXTURE_ITEMS
    const counts: { member_id: string; collection: string; count: number }[] = []
    const seen = new Map<string, number>()
    for (const item of FIXTURE_ITEMS) {
      const key = `${item.member_id}|${item.collection}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    for (const [key, count] of seen.entries()) {
      const [member_id, collection] = key.split('|')
      counts.push({ member_id, collection, count })
    }
    return HttpResponse.json(counts)
  }),

  // Fallback for any other Supabase endpoint we forgot — return empty rather
  // than fail the test. The Next.js page may throw if it expected data, but
  // at least we'll get a clear failure message rather than a network error.
  http.all(`${SUPABASE_BASE}/rest/v1/*`, () => HttpResponse.json([])),
]
