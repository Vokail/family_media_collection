/**
 * Tiny client-side navigation helper. Wraps `window.location.assign` so that
 * test suites can mock it (jsdom's Location object is sealed). Used by code
 * paths that need a hard reload — e.g. after adding an item to refresh
 * server-rendered collection pages with fresh data.
 */
export function navigateTo(url: string): void {
  if (typeof window !== 'undefined') {
    window.location.assign(url)
  }
}
