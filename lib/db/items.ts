import { createServerClient } from '../supabase-server'
import type { Item, CollectionType, ActivityItem } from '../types'

// isWishlist optional — omit to load all items for a collection (needed for client-side toggle)
export async function listItems(memberId: string, collection: CollectionType, isWishlist?: boolean): Promise<Item[]> {
  const db = createServerClient()
  let query = db.from('items').select('*').eq('member_id', memberId).eq('collection', collection)
  if (isWishlist !== undefined) query = query.eq('is_wishlist', isWishlist)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createItem(item: Omit<Item, 'id' | 'created_at'>): Promise<Item> {
  const db = createServerClient()
  const { data, error } = await db.from('items').insert(item).select().single()
  if (error) throw error
  return data
}

export async function updateItem(id: string, patch: Partial<Pick<Item, 'is_wishlist' | 'notes' | 'rating' | 'cover_path'>>): Promise<Item> {
  const db = createServerClient()
  const { data, error } = await db.from('items').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteItem(id: string): Promise<void> {
  const db = createServerClient()
  const { error } = await db.from('items').delete().eq('id', id)
  if (error) throw error
}

export async function listAllItems(memberId: string): Promise<Item[]> {
  const db = createServerClient()
  const { data, error } = await db.from('items').select('*').eq('member_id', memberId).order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listRecentActivity(limit = 15): Promise<ActivityItem[]> {
  const db = createServerClient()
  const { data, error } = await db
    .from('items')
    .select('id, title, creator, collection, cover_path, created_at, members(name, slug)')
    .eq('is_wishlist', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(item => {
    const member = (item.members as unknown as { name: string; slug: string })
    return {
      id: item.id,
      title: item.title,
      creator: item.creator,
      collection: item.collection as CollectionType,
      cover_path: item.cover_path,
      created_at: item.created_at,
      member_name: member.name,
      member_slug: member.slug,
    }
  })
}

export async function listWishlistItems(): Promise<Item[]> {
  const db = createServerClient()
  const { data, error } = await db
    .from('items')
    .select('*')
    .eq('is_wishlist', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
