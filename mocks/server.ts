/**
 * MSW Node server — runs inside the Next.js dev server process during e2e
 * tests. Started by `instrumentation.ts` when PLAYWRIGHT_TEST=1.
 */
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
