import { createServerClient } from '../supabase-server'

export async function getSettingHash(key: 'view_pin_hash' | 'family_password_hash'): Promise<string | null> {
  const db = createServerClient()
  const { data } = await db.from('settings').select('value').eq('key', key).single()
  return data?.value ?? null
}

export async function upsertSettingHash(key: 'view_pin_hash' | 'family_password_hash', hash: string) {
  const db = createServerClient()
  await db.from('settings').upsert({ key, value: hash })
}
