/**
 * Test-only API endpoint that lets Playwright step definitions configure MSW
 * state before navigating to a page. Only active when PLAYWRIGHT_TEST=1.
 *
 * Actions:
 *   reset        — restore testState.items to FIXTURE_ITEMS and members to FIXTURE_MEMBERS
 *   patchItem    — update a single item by id
 *   setCollection — replace all items for a given member_id + collection
 *   addItem      — push a new item into testState
 *   patchMember  — update a single member by id (e.g. enabled_collections)
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  if (process.env.PLAYWRIGHT_TEST !== '1') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { testState, resetTestState } = await import('@/mocks/test-state')

  const body = await request.json() as {
    action: 'reset' | 'patchItem' | 'setCollection' | 'addItem' | 'patchMember'
    id?: string
    patch?: Record<string, unknown>
    member_id?: string
    collection?: string
    items?: unknown[]
    item?: unknown
  }

  switch (body.action) {
    case 'reset':
      resetTestState()
      break

    case 'patchItem':
      if (body.id && body.patch) {
        const idx = testState.items.findIndex(i => i.id === body.id)
        if (idx >= 0) {
          testState.items[idx] = { ...testState.items[idx], ...body.patch } as typeof testState.items[0]
        }
      }
      break

    case 'setCollection':
      if (body.member_id && body.collection && body.items) {
        testState.items = [
          ...testState.items.filter(
            i => !(i.member_id === body.member_id && i.collection === body.collection),
          ),
          ...(body.items as typeof testState.items),
        ]
      }
      break

    case 'addItem':
      if (body.item) {
        testState.items.push(body.item as typeof testState.items[0])
      }
      break

    case 'patchMember':
      if (body.id && body.patch) {
        const idx = testState.members.findIndex(m => m.id === body.id)
        if (idx >= 0) {
          testState.members[idx] = { ...testState.members[idx], ...body.patch } as typeof testState.members[0]
        }
      }
      break
  }

  return NextResponse.json({ ok: true })
}
