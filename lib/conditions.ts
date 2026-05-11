/**
 * Vinyl record condition grades (#130).
 * Single source of truth shared by ItemCard (badge display + picker) and
 * CollectionGrid (sorting + grouped view).
 */

export const CONDITION_OPTIONS = [
  { value: 'mint',      abbr: 'M',  name: 'Mint',      color: '#16a34a' },
  { value: 'near_mint', abbr: 'NM', name: 'Near Mint', color: '#0891b2' },
  { value: 'good',      abbr: 'G',  name: 'Good',      color: '#d97706' },
  { value: 'poor',      abbr: 'P',  name: 'Poor',      color: '#dc2626' },
] as const

export type ConditionValue = typeof CONDITION_OPTIONS[number]['value']

/** Ordered list of condition values from best to worst (used for sorting). */
export const CONDITION_ORDER: readonly ConditionValue[] = CONDITION_OPTIONS.map(c => c.value)
