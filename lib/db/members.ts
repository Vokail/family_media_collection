import { createServerClient } from '../supabase-server'
import type { Member, CollectionType } from '../types'

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

export async function getMemberById(id: string): Promise<Member | null> {
  const db = createServerClient()
  const { data } = await db.from('members').select('*').eq('id', id).single()
  return data
}

export async function listMembersWithPinHashes(): Promise<(Member & { pin_hash: string | null })[]> {
  const db = createServerClient()
  const { data, error } = await db.from('members').select('id, name, slug, pin_hash').order('name')
  if (error) throw error
  return (data ?? []) as (Member & { pin_hash: string | null })[]
}

export async function setMemberPinHash(memberId: string, hash: string): Promise<void> {
  const db = createServerClient()
  await db.from('members').update({ pin_hash: hash }).eq('id', memberId)
}

export async function updateMemberCollections(memberId: string, collections: CollectionType[]): Promise<void> {
  const db = createServerClient()
  await db.from('members').update({ enabled_collections: collections }).eq('id', memberId)
}

export async function updateMemberAvatar(memberId: string, avatarPath: string | null): Promise<void> {
  const db = createServerClient()
  await db.from('members').update({ avatar_path: avatarPath }).eq('id', memberId)
}

export async function listMemberItemCounts(): Promise<Record<string, MemberItemCounts>> {
  const db = createServerClient()
  // Uses a DB-level GROUP BY aggregate (see migration 011_item_counts_fn.sql)
  // to avoid fetching all item rows into JS just to count them.
  const { data } = await db.rpc('get_member_item_counts')
  const result: Record<string, MemberItemCounts> = {}
  for (const row of (data ?? []) as { member_id: string; collection: string; count: number }[]) {
    if (!result[row.member_id]) result[row.member_id] = {}
    result[row.member_id][row.collection] = Number(row.count)
  }
  return result
}
