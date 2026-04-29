import { isNew, relativeTime, toTitleCase } from '@/lib/utils'

describe('toTitleCase', () => {
  it('capitalises the first letter of each word', () => {
    expect(toTitleCase('the lord of the rings')).toBe('The Lord Of The Rings')
  })

  it('handles already-uppercase input', () => {
    expect(toTitleCase('DUNE')).toBe('Dune')
  })

  it('capitalises after hyphens', () => {
    expect(toTitleCase('spider-man')).toBe('Spider-Man')
  })

  it('returns empty string unchanged', () => {
    expect(toTitleCase('')).toBe('')
  })

  it('handles mixed case input', () => {
    expect(toTitleCase('tOwErS oF mIdNiGhT')).toBe('Towers Of Midnight')
  })

  it('handles single word', () => {
    expect(toTitleCase('dune')).toBe('Dune')
  })
})

describe('isNew', () => {
  it('returns true for an item created today', () => {
    expect(isNew(new Date().toISOString())).toBe(true)
  })

  it('returns true for an item created 13 days ago', () => {
    const d = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
    expect(isNew(d.toISOString())).toBe(true)
  })

  it('returns false for an item created 15 days ago', () => {
    const d = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
    expect(isNew(d.toISOString())).toBe(false)
  })

  it('respects a custom threshold', () => {
    const d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    expect(isNew(d.toISOString(), 2)).toBe(false)
    expect(isNew(d.toISOString(), 5)).toBe(true)
  })
})

describe('relativeTime', () => {
  function ago(ms: number) {
    return new Date(Date.now() - ms).toISOString()
  }

  it('returns "just now" for under 2 minutes', () => {
    expect(relativeTime(ago(30 * 1000))).toBe('just now')
    expect(relativeTime(ago(60 * 1000))).toBe('just now')
  })

  it('returns minutes ago for under an hour', () => {
    expect(relativeTime(ago(5 * 60 * 1000))).toBe('5 minutes ago')
    expect(relativeTime(ago(45 * 60 * 1000))).toBe('45 minutes ago')
  })

  it('returns hours ago for under a day', () => {
    expect(relativeTime(ago(2 * 60 * 60 * 1000))).toBe('2 hours ago')
    expect(relativeTime(ago(1 * 60 * 60 * 1000))).toBe('1 hour ago')
  })

  it('returns "yesterday" for 1 day ago', () => {
    expect(relativeTime(ago(25 * 60 * 60 * 1000))).toBe('yesterday')
  })

  it('returns days ago for under a week', () => {
    expect(relativeTime(ago(3 * 24 * 60 * 60 * 1000))).toBe('3 days ago')
  })

  it('returns "1 week ago" for 7–13 days', () => {
    expect(relativeTime(ago(8 * 24 * 60 * 60 * 1000))).toBe('1 week ago')
  })

  it('returns weeks ago for 14–29 days', () => {
    expect(relativeTime(ago(21 * 24 * 60 * 60 * 1000))).toBe('3 weeks ago')
  })

  it('returns "1 month ago" for 30–59 days', () => {
    expect(relativeTime(ago(40 * 24 * 60 * 60 * 1000))).toBe('1 month ago')
  })

  it('returns months ago for 60+ days', () => {
    expect(relativeTime(ago(90 * 24 * 60 * 60 * 1000))).toBe('3 months ago')
  })
})
