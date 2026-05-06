import { buildConditionGroups } from '@/components/CollectionGrid'
import type { Item } from '@/lib/types'

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'id', member_id: 'm', collection: 'vinyl', title: 'T', creator: 'C',
    year: null, cover_path: null, is_wishlist: false, notes: null,
    created_at: '2024-01-01', external_id: null, sort_name: null,
    tracklist: null, description: null, rating: null, isbn: null,
    genres: null, styles: null, status: null, lego_status: null,
    condition: null, locked_fields: null,
    ...overrides,
  }
}

describe('buildConditionGroups (#114)', () => {
  it('groups near_mint items under the "Near Mint" label', () => {
    const items = [makeItem({ id: '1', condition: 'near_mint' })]
    const groups = buildConditionGroups(items)
    const nm = groups.find(g => g.label === 'Near Mint')
    expect(nm).toBeDefined()
    expect(nm!.items).toHaveLength(1)
  })

  it('groups mint items correctly', () => {
    const items = [makeItem({ id: '1', condition: 'mint' })]
    const groups = buildConditionGroups(items)
    expect(groups.find(g => g.label === 'Mint')!.items).toHaveLength(1)
  })

  it('puts items with no condition into Ungraded group', () => {
    const items = [makeItem({ id: '1', condition: null })]
    const groups = buildConditionGroups(items)
    expect(groups.find(g => g.label === 'Ungraded')!.items).toHaveLength(1)
  })

  it('omits empty grade groups', () => {
    const items = [makeItem({ id: '1', condition: 'mint' })]
    const groups = buildConditionGroups(items)
    expect(groups.find(g => g.label === 'Near Mint')).toBeUndefined()
    expect(groups.find(g => g.label === 'Good')).toBeUndefined()
  })
})
