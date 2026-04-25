import bcrypt from 'bcryptjs'
import { getSettingHash, upsertSettingHash } from './db/settings'
import type { Role } from './types'

export async function resolveRole(input: string): Promise<Role | null> {
  const [viewHash, editHash] = await Promise.all([
    getSettingHash('view_pin_hash'),
    getSettingHash('family_password_hash'),
  ])
  if (editHash && await bcrypt.compare(input, editHash)) return 'editor'
  if (viewHash && await bcrypt.compare(input, viewHash)) return 'viewer'
  return null
}

export async function seedCredentialsIfMissing() {
  const existing = await getSettingHash('family_password_hash')
  if (existing) return
  const [pinHash, passHash] = await Promise.all([
    bcrypt.hash(process.env.INITIAL_VIEW_PIN!, 10),
    bcrypt.hash(process.env.INITIAL_FAMILY_PASSWORD!, 10),
  ])
  await upsertSettingHash('view_pin_hash', pinHash)
  await upsertSettingHash('family_password_hash', passHash)
}

export async function updateCredential(
  key: 'view_pin_hash' | 'family_password_hash',
  newValue: string,
) {
  const hash = await bcrypt.hash(newValue, 10)
  await upsertSettingHash(key, hash)
}
