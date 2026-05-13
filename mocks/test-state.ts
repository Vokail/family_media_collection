/**
 * Mutable state store for MSW handlers during Playwright e2e tests.
 * Step definitions call /api/__test/fixtures to modify this state before
 * navigating to a page, so that the SSR page renders with the right data.
 */
import { FIXTURE_ITEMS } from './fixtures'
import type { Item } from '@/lib/types'

// Mutable snapshot — MSW handlers read from this; the test-fixture API modifies it
export const testState = {
  items: [...FIXTURE_ITEMS] as Item[],
}

export function resetTestState(): void {
  testState.items = [...FIXTURE_ITEMS]
}
