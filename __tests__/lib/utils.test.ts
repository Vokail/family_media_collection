import { isNew } from '@/lib/utils'

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
