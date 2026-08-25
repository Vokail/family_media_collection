import {
  creatorLabel,
  collectionSearchPlaceholder,
  addSearchPlaceholder,
} from '@/lib/search-labels'

describe('creatorLabel', () => {
  it('names what the creator column actually holds per collection', () => {
    // Lego stores the theme ("Icons", "Creator Expert"), not a person.
    expect(creatorLabel('lego')).toBe('theme')
    expect(creatorLabel('book')).toBe('author')
    expect(creatorLabel('comic')).toBe('author')
    expect(creatorLabel('vinyl')).toBe('artist')
  })
})

describe('collectionSearchPlaceholder', () => {
  it('never says "artist" for a collection that has no artist (#151)', () => {
    for (const c of ['lego', 'book', 'comic'] as const) {
      expect(collectionSearchPlaceholder(c)).not.toMatch(/artist/i)
    }
  })

  it('asks for set or theme on Lego', () => {
    expect(collectionSearchPlaceholder('lego')).toBe('Search set or theme…')
  })

  it('asks for author on books and comics', () => {
    expect(collectionSearchPlaceholder('book')).toBe('Search title or author…')
    expect(collectionSearchPlaceholder('comic')).toBe('Search title or author…')
  })

  it('keeps artist for vinyl', () => {
    expect(collectionSearchPlaceholder('vinyl')).toBe('Search title or artist…')
  })
})

describe('addSearchPlaceholder', () => {
  it('asks only for the album on vinyl, since Artist has its own field', () => {
    expect(addSearchPlaceholder('vinyl')).toBe('Album title…')
    expect(addSearchPlaceholder('vinyl')).not.toMatch(/artist/i)
  })

  it('matches the collection placeholder everywhere else', () => {
    for (const c of ['lego', 'book', 'comic'] as const) {
      expect(addSearchPlaceholder(c)).toBe(collectionSearchPlaceholder(c))
    }
  })
})
