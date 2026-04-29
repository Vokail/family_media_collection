import bcrypt from 'bcryptjs'
import { getSettingHash, upsertSettingHash } from './db/settings'
import { listMembersWithPinHashes, setMemberPinHash } from './db/members'
import type { Role } from './types'

export interface ResolveRoleResult {
  role: Role
  memberId?: string
}

export async function resolveRole(input: string): Promise<ResolveRoleResult | null> {
  const [viewHash, editHash] = await Promise.all([
    getSettingHash('view_pin_hash'),
    getSettingHash('family_password_hash'),
  ])
  if (editHash && await bcrypt.compare(input, editHash)) return { role: 'editor' }
  if (viewHash && await bcrypt.compare(input, viewHash)) return { role: 'viewer' }

  // Check per-member PINs
  const members = await listMembersWithPinHashes()
  for (const member of members) {
    if (member.pin_hash && await bcrypt.compare(input, member.pin_hash)) {
      return { role: 'member', memberId: member.id }
    }
  }
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

export async function updateMemberPin(memberId: string, newValue: string): Promise<'conflict' | 'ok'> {
  // Check no other member already uses this PIN
  const others = await listMembersWithPinHashes()
  for (const m of others) {
    if (m.id !== memberId && m.pin_hash && await bcrypt.compare(newValue, m.pin_hash)) {
      return 'conflict'
    }
  }
  const hash = await bcrypt.hash(newValue, 10)
  await setMemberPinHash(memberId, hash)
  return 'ok'
}
