import { createServerClient } from '../supabase-server'
import type { Member } from '../types'

export type MemberItemCounts = Record<string, number>

export async function listMembers(): Promise<Member[]> {
  const db = createServerClient()
  const { data, error } = await db.from('members').select('*').order('name')
  if (error) throw error
  return data
}

export async function getMemberBySlug(slug: string): Promise<Member | null> {
  const db = createServerClient()
  const { data } = await db.from('members').select('*').eq('slug', slug).single()
  return data
}

export async function listMemberItemCounts(): Promise<Record<string, MemberItemCounts>> {
  const db = createServerClient()
  const { data } = await db.from('items').select('member_id, collection').eq('is_wishlist', false)
  const result: Record<string, MemberItemCounts> = {}
  for (const row of data ?? []) {
    if (!result[row.member_id]) result[row.member_id] = {}
    result[row.member_id][row.collection] = (result[row.member_id][row.collection] ?? 0) + 1
  }
  return result
}
