/**
 * backfill.test.ts
 *
 * Tests for the cleanupOrphanedCovers step added to the backfill route (#122).
 * We mock Supabase and the session, then exercise just the cleanup logic by
 * triggering the full GET handler with ?types= (empty list) so no backfill
 * work happens, and only the cleanup runs.
 */

jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))
jest.mock('@/lib/supabase-server', () => ({ createServerClient: jest.fn() }))

import { GET } from '@/app/api/admin/backfill-sort/route'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'

const mockGetSession = getSession as jest.Mock
const mockCreateClient = createServerClient as jest.Mock

type BlobEntry = { name: string; id: string | null }
type FolderMap = Record<string, BlobEntry[]>  // prefix → children

/**
 * Build a minimal mock Supabase client that stubs storage list/remove + items.select.
 *
 * @param blobsRoot  Entries returned for the root ("") list call.
 *                   Use id=null to simulate a folder; the folder's children are
 *                   looked up in `folderContents[entry.name]`.
 * @param folderContents  Map from folder path to child entries (one level deep).
 *                        For two-level folders set the child's id=null and add a
 *                        key for the nested path.
 * @param referencedPaths  cover_path values that should be in the items table.
 */
function makeDb({
  blobsRoot = [] as BlobEntry[],
  folderContents = {} as FolderMap,
  referencedPaths = [] as string[],
  removeError = null as string | null,
} = {}) {
  const mockRemove = jest.fn().mockResolvedValue({ error: removeError ? { message: removeError } : null })

  const storageMock = {
    from: jest.fn(() => ({
      list: jest.fn(async (prefix: string) => {
        if (prefix === '') return { data: blobsRoot }
        return { data: folderContents[prefix] ?? [] }
      }),
      remove: mockRemove,
    })),
  }

  // items.select('cover_path').not().range() chain
  const fromItemsMock = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({
      data: referencedPaths.map(p => ({ cover_path: p })),
      error: null,
    }),
  })

  const db = {
    storage: storageMock,
    from: fromItemsMock,
  }

  mockCreateClient.mockReturnValue(db)
  return { db, mockRemove }
}

function makeGet(searchParams = '') {
  const url = `http://localhost/api/admin/backfill-sort?types=${encodeURIComponent('')}${searchParams}`
  return new Request(url)
}

beforeEach(() => {
  jest.resetAllMocks()
  mockGetSession.mockResolvedValue({ role: 'editor' })
})

describe('backfill route — orphaned cover cleanup', () => {
  it('reports zero orphans when storage is empty', async () => {
    makeDb({ blobsRoot: [], referencedPaths: [] })
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.orphanedCovers).toEqual({ scanned: 0, orphans: 0, deleted: 0 })
  })

  it('reports zero orphans when all blobs are referenced', async () => {
    makeDb({
      blobsRoot: [
        { name: 'member-1/cover-a.jpg', id: 'blob-1' },
        { name: 'member-1/cover-b.jpg', id: 'blob-2' },
      ],
      referencedPaths: ['covers/member-1/cover-a.jpg', 'covers/member-1/cover-b.jpg'],
    })
    const res = await GET(makeGet())
    const body = await res.json()
    expect(body.summary.orphanedCovers).toEqual({ scanned: 2, orphans: 0, deleted: 0 })
  })

  it('deletes unreferenced blobs', async () => {
    const { mockRemove } = makeDb({
      blobsRoot: [
        { name: 'member-1/cover-a.jpg', id: 'blob-1' },
        { name: 'member-1/orphan.jpg', id: 'blob-2' },  // not in items table
      ],
      referencedPaths: ['covers/member-1/cover-a.jpg'],
    })
    const res = await GET(makeGet())
    const body = await res.json()
    expect(body.summary.orphanedCovers).toEqual({ scanned: 2, orphans: 1, deleted: 1 })
    expect(mockRemove).toHaveBeenCalledWith(['member-1/orphan.jpg'])
  })

  it('strips leading "covers/" prefix when comparing referenced paths', async () => {
    const { mockRemove } = makeDb({
      blobsRoot: [
        { name: 'manual/member-2/photo.jpg', id: 'blob-x' },
      ],
      // cover_path stored with "covers/" prefix in DB
      referencedPaths: ['covers/manual/member-2/photo.jpg'],
    })
    const res = await GET(makeGet())
    const body = await res.json()
    // Should NOT be treated as an orphan
    expect(body.summary.orphanedCovers.orphans).toBe(0)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('skips cleanup when ?skipCleanup=true', async () => {
    const { mockRemove } = makeDb({
      blobsRoot: [{ name: 'member-1/orphan.jpg', id: 'blob-1' }],
      referencedPaths: [],
    })
    const res = await GET(new Request('http://localhost/api/admin/backfill-sort?types=&skipCleanup=true'))
    const body = await res.json()
    expect(body.summary.orphanedCovers).toBeUndefined()
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('returns 403 for non-editor sessions', async () => {
    makeDb()
    mockGetSession.mockResolvedValue({ role: 'viewer' })
    const res = await GET(makeGet())
    expect(res.status).toBe(403)
  })

  it('treats blobs referenced without "covers/" prefix as non-orphans', async () => {
    // Some older items might store cover_path without the bucket prefix
    const { mockRemove } = makeDb({
      blobsRoot: [{ name: 'member-1/old-style.jpg', id: 'blob-1' }],
      referencedPaths: ['member-1/old-style.jpg'],  // no "covers/" prefix
    })
    const res = await GET(makeGet())
    const body = await res.json()
    expect(body.summary.orphanedCovers.orphans).toBe(0)
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('traverses two-level folder structure (root → folder → file)', async () => {
    // Storage layout:  manual/ (folder)  →  manual/member-3/ (folder)  →  manual/member-3/f.jpg (file)
    // The cleanup code lists root, sees "manual" with no id (folder), recurses into it,
    // sees "member-3" with no id (sub-folder), recurses again, finds the actual file.
    const { mockRemove } = makeDb({
      blobsRoot: [{ name: 'manual', id: null }],                           // root: one folder
      folderContents: {
        'manual': [{ name: 'member-3', id: null }],                        // level 1: sub-folder
        'manual/member-3': [{ name: 'f.jpg', id: 'blob-nested' }],         // level 2: file
      },
      referencedPaths: [],  // not referenced → orphan
    })
    const res = await GET(makeGet())
    const body = await res.json()
    expect(body.summary.orphanedCovers).toEqual({ scanned: 1, orphans: 1, deleted: 1 })
    expect(mockRemove).toHaveBeenCalledWith(['manual/member-3/f.jpg'])
  })

  it('batches deletions when orphan count exceeds 100', async () => {
    // Generate 150 orphaned blobs at root level
    const blobsRoot: BlobEntry[] = Array.from({ length: 150 }, (_, i) => ({
      name: `orphan-${i}.jpg`,
      id: `blob-${i}`,
    }))
    const { mockRemove } = makeDb({ blobsRoot, referencedPaths: [] })

    const res = await GET(makeGet())
    const body = await res.json()
    expect(body.summary.orphanedCovers).toEqual({ scanned: 150, orphans: 150, deleted: 150 })

    // Should have been called twice: first batch of 100, second of 50
    expect(mockRemove).toHaveBeenCalledTimes(2)
    expect(mockRemove.mock.calls[0][0]).toHaveLength(100)
    expect(mockRemove.mock.calls[1][0]).toHaveLength(50)
  })
})
