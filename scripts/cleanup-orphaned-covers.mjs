/**
 * cleanup-orphaned-covers.mjs
 *
 * Finds cover blobs in Supabase Storage that are no longer referenced by any
 * item in the database, and optionally deletes them.
 *
 * This is needed because the PATCH {cover_path: null} handler previously did
 * not clean up the old blob (fixed in #122). Run this once after deploying
 * the fix to remove files accumulated during development/testing.
 *
 * Usage:
 *   node scripts/cleanup-orphaned-covers.mjs          # dry run (list only)
 *   node scripts/cleanup-orphaned-covers.mjs --delete  # actually delete
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ─── Load env from .env.local ────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local')
let env = {}
try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
} catch {
  console.error('Could not read .env.local — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY manually.')
  process.exit(1)
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const DRY_RUN = !process.argv.includes('--delete')
const db = createClient(SUPABASE_URL, SERVICE_KEY)

// ─── 1. List all blobs in the covers bucket ──────────────────────────────────
async function listAllBlobs() {
  const blobs = []
  // Supabase Storage list() is paginated (limit 100 per call).
  // We list the top-level "folders" (member UUIDs) first, then files within each.
  const { data: topLevel } = await db.storage.from('covers').list('', { limit: 1000 })
  for (const entry of topLevel ?? []) {
    if (entry.id) {
      // It's a file directly at root level
      blobs.push(entry.name)
    } else {
      // It's a folder — list its contents
      const { data: children } = await db.storage.from('covers').list(entry.name, { limit: 1000 })
      for (const child of children ?? []) {
        if (child.id) {
          blobs.push(`${entry.name}/${child.name}`)
        } else {
          // One level deeper (e.g. manual/<member_id>/<file>)
          const { data: grandchildren } = await db.storage.from('covers').list(`${entry.name}/${child.name}`, { limit: 1000 })
          for (const gc of grandchildren ?? []) {
            if (gc.id) blobs.push(`${entry.name}/${child.name}/${gc.name}`)
          }
        }
      }
    }
  }
  return blobs
}

// ─── 2. Get all cover_path values referenced by items ───────────────────────
async function getReferencedPaths() {
  const referenced = new Set()
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await db
      .from('items')
      .select('cover_path')
      .not('cover_path', 'is', null)
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    for (const row of data ?? []) {
      // Strip leading "covers/" — storage keys don't include the bucket prefix
      const key = row.cover_path.startsWith('covers/')
        ? row.cover_path.slice('covers/'.length)
        : row.cover_path
      referenced.add(key)
    }
    if ((data?.length ?? 0) < PAGE) break
    offset += PAGE
  }
  return referenced
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍  Scanning Supabase Storage bucket "covers"…`)
  const [allBlobs, referenced] = await Promise.all([listAllBlobs(), getReferencedPaths()])

  console.log(`   Storage blobs found : ${allBlobs.length}`)
  console.log(`   Items with covers   : ${referenced.size}`)

  const orphans = allBlobs.filter(b => !referenced.has(b))
  console.log(`   Orphaned blobs      : ${orphans.length}\n`)

  if (orphans.length === 0) {
    console.log('✅  No orphaned covers found.')
    return
  }

  for (const key of orphans) {
    console.log(`  ${DRY_RUN ? '[dry-run] would delete' : 'deleting'}: ${key}`)
  }

  if (DRY_RUN) {
    console.log(`\n⚠️  Dry run — no files deleted. Re-run with --delete to remove them.`)
    return
  }

  // Delete in batches of 100 (Supabase Storage limit)
  const BATCH = 100
  let deleted = 0
  for (let i = 0; i < orphans.length; i += BATCH) {
    const batch = orphans.slice(i, i + BATCH)
    const { error } = await db.storage.from('covers').remove(batch)
    if (error) {
      console.error(`  ❌  Error deleting batch: ${error.message}`)
    } else {
      deleted += batch.length
    }
  }
  console.log(`\n✅  Deleted ${deleted} orphaned cover(s).`)
}

main().catch(err => { console.error(err); process.exit(1) })
