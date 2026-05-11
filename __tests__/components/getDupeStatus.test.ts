/**
 * Unit tests for getDupeStatus / makeDupeMap (lib/getDupeStatus.ts, #125).
 *
 * getDupeStatus checks whether a search result is already in the user's
 * collection. It uses two lookup maps built by makeDupeMap:
 *   byId    — matches by external_id (most precise)
 *   byTitle — matches by title+creator (fallback for sources without reliable IDs)
 *
 * Regression: Rebrickable and Discogs assign globally-unique IDs. When a result
 * has an external_id that doesn't match anything in the collection, the title
 * fallback must be skipped — otherwise a different Lego set with the same name
 * (e.g. 75375-1 vs 75192-1, both "Millennium Falcon") incorrectly shows as
 * "in collection".
 */

import { makeDupeMap, getDupeStatus } from '@/lib/getDupeStatus'
import type { SearchResult } from '@/lib/types'

// ─── helpers ────────────────────────────────────────────────────────────────

const ownedSet = (external_id: string, title: string, creator = 'Star Wars') => ({
  external_id,
  title,
  creator,
  is_wishlist: false,
})

const legoResult = (external_id: string, title = 'Millennium Falcon'): Pick<SearchResult, 'external_id' | 'title' | 'creator' | 'source'> => ({
  external_id,
  title,
  creator: 'Star Wars',
  source: 'rebrickable',
})

const vinylResult = (external_id: string, title = 'Abbey Road'): Pick<SearchResult, 'external_id' | 'title' | 'creator' | 'source'> => ({
  external_id,
  title,
  creator: 'The Beatles',
  source: 'discogs',
})

const bookResult = (external_id: string | null, title: string, creator = 'Frank Herbert'): Pick<SearchResult, 'external_id' | 'title' | 'creator' | 'source'> => ({
  external_id,
  title,
  creator,
  source: 'openlibrary',
})

// ─── tests ───────────────────────────────────────────────────────────────────

describe('getDupeStatus — exact external_id match', () => {
  it('returns owned when external_id matches an owned item', () => {
    const dm = makeDupeMap([ownedSet('75192-1', 'Millennium Falcon')])
    expect(getDupeStatus(legoResult('75192-1'), dm)).toBe('owned')
  })

  it('returns wishlist when external_id matches a wishlist item', () => {
    const dm = makeDupeMap([{ ...ownedSet('75192-1', 'Millennium Falcon'), is_wishlist: true }])
    expect(getDupeStatus(legoResult('75192-1'), dm)).toBe('wishlist')
  })
})

describe('getDupeStatus — Rebrickable: skip title fallback for different set numbers (#116)', () => {
  it('returns null for a different Lego set that shares a name (75375-1 vs 75192-1)', () => {
    const dm = makeDupeMap([ownedSet('75192-1', 'Millennium Falcon')])
    expect(getDupeStatus(legoResult('75375-1', 'Millennium Falcon'), dm)).toBeNull()
  })

  it('returns null for a Lego set that has no match at all', () => {
    const dm = makeDupeMap([ownedSet('75192-1', 'Millennium Falcon')])
    expect(getDupeStatus(legoResult('60001-1', 'City Car'), dm)).toBeNull()
  })
})

describe('getDupeStatus — Discogs: skip title fallback for different release IDs', () => {
  it('returns null for a different vinyl release with the same album name', () => {
    const dm = makeDupeMap([ownedSet('1001', 'Abbey Road')])
    expect(getDupeStatus(vinylResult('9999', 'Abbey Road'), dm)).toBeNull()
  })

  it('returns owned when the exact Discogs release is in the collection', () => {
    const dm = makeDupeMap([ownedSet('1001', 'Abbey Road')])
    expect(getDupeStatus(vinylResult('1001', 'Abbey Road'), dm)).toBe('owned')
  })
})

describe('getDupeStatus — OpenLibrary: title fallback still applies', () => {
  it('returns owned via title match when book was added without external_id', () => {
    const dm = makeDupeMap([{ external_id: null, title: 'Dune', creator: 'Frank Herbert', is_wishlist: false }])
    expect(getDupeStatus(bookResult('/works/OL1234W', 'Dune'), dm)).toBe('owned')
  })

  it('returns null when title does not match', () => {
    const dm = makeDupeMap([{ external_id: null, title: 'Dune', creator: 'Frank Herbert', is_wishlist: false }])
    expect(getDupeStatus(bookResult('/works/OL9999W', 'Foundation'), dm)).toBeNull()
  })

  it('returns owned via external_id match for books', () => {
    const dm = makeDupeMap([ownedSet('/works/OL1234W', 'Dune', 'Frank Herbert')])
    expect(getDupeStatus(bookResult('/works/OL1234W', 'Dune'), dm)).toBe('owned')
  })
})
