/**
 * Mutable state store for MSW handlers during Playwright e2e tests.
 * Step definitions call /api/playwright-fixtures to modify this state before
 * navigating to a page, so that the SSR page renders with the right data.
 *
 * WHY globalThis: Next.js App Router compiles instrumentation.ts (which starts
 * MSW) and API route handlers in separate webpack chunks. Each chunk gets its
 * own module registry, so a plain module-level `export const testState` object
 * can end up as TWO different instances — one read by the MSW handlers and one
 * written by the /api/playwright-fixtures route. Using globalThis ensures both
 * chunks reference the same object, regardless of module isolation.
 */
import { FIXTURE_ITEMS, FIXTURE_MEMBERS } from './fixtures'
import type { Item, Member } from '@/lib/types'

declare global {
  // eslint-disable-next-line no-var
  var __pw_items: Item[] | undefined
  // eslint-disable-next-line no-var
  var __pw_members: Member[] | undefined
}

// Initialise on first module load (whichever bundle loads first).
if (globalThis.__pw_items === undefined) {
  globalThis.__pw_items = [...FIXTURE_ITEMS]
}
if (globalThis.__pw_members === undefined) {
  globalThis.__pw_members = FIXTURE_MEMBERS.map(m => ({ ...m }))
}

/** Proxy that always reads/writes the single globalThis-backed instance. */
export const testState = {
  get items(): Item[]          { return globalThis.__pw_items! },
  set items(v: Item[])         { globalThis.__pw_items = v },
  get members(): Member[]      { return globalThis.__pw_members! },
  set members(v: Member[])     { globalThis.__pw_members = v },
}

export function resetTestState(): void {
  globalThis.__pw_items   = [...FIXTURE_ITEMS]
  globalThis.__pw_members = FIXTURE_MEMBERS.map(m => ({ ...m }))
}
