import { createServerClient } from '../supabase-server'
import type { Member } from '../types'

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
