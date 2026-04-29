import bcrypt from 'bcryptjs'

jest.mock('@/lib/db/settings', () => ({
  getSettingHash: jest.fn(),
  upsertSettingHash: jest.fn(),
}))

jest.mock('@/lib/db/members', () => ({
  listMembersWithPinHashes: jest.fn(),
  setMemberPinHash: jest.fn(),
}))

import { getSettingHash, upsertSettingHash } from '@/lib/db/settings'
import { listMembersWithPinHashes, setMemberPinHash } from '@/lib/db/members'
import { resolveRole, updateCredential, updateMemberPin } from '@/lib/auth'

const mockGetHash = getSettingHash as jest.Mock
const mockUpsert = upsertSettingHash as jest.Mock
const mockListMembers = listMembersWithPinHashes as jest.Mock
const mockSetPinHash = setMemberPinHash as jest.Mock

describe('resolveRole', () => {
  beforeEach(() => {
    mockListMembers.mockResolvedValue([])
  })

  it('returns editor result when input matches family password', async () => {
    const hash = await bcrypt.hash('secret', 10)
    mockGetHash.mockReset()
    mockGetHash.mockImplementation(async (key: string) =>
      key === 'family_password_hash' ? hash : null
    )
    const result = await resolveRole('secret')
    expect(result).toEqual({ role: 'editor' })
  })

  it('returns viewer result when input matches view pin', async () => {
    const hash = await bcrypt.hash('1234', 10)
    mockGetHash.mockReset()
    mockGetHash.mockImplementation(async (key: string) =>
      key === 'view_pin_hash' ? hash : null
    )
    const result = await resolveRole('1234')
    expect(result).toEqual({ role: 'viewer' })
  })

  it('returns member result with memberId when input matches a member PIN', async () => {
    mockGetHash.mockReset()
    mockGetHash.mockResolvedValue(null)
    const pinHash = await bcrypt.hash('mypin', 10)
    mockListMembers.mockResolvedValue([
      { id: 'member-uuid-1', name: 'Alice', slug: 'alice', pin_hash: pinHash },
    ])
    const result = await resolveRole('mypin')
    expect(result).toEqual({ role: 'member', memberId: 'member-uuid-1' })
  })

  it('returns null when input matches nothing', async () => {
    mockGetHash.mockReset()
    mockGetHash.mockResolvedValue(null)
    mockListMembers.mockResolvedValue([{ id: 'member-uuid-1', name: 'Alice', slug: 'alice', pin_hash: null }])
    const result = await resolveRole('wrong')
    expect(result).toBeNull()
  })
})

describe('updateCredential', () => {
  it('hashes new value and upserts it', async () => {
    mockUpsert.mockReset()
    mockUpsert.mockResolvedValue(undefined)
    await updateCredential('view_pin_hash', 'newpin')
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const [key, hash] = mockUpsert.mock.calls[0]
    expect(key).toBe('view_pin_hash')
    expect(await bcrypt.compare('newpin', hash)).toBe(true)
  })
})

describe('updateMemberPin', () => {
  beforeEach(() => {
    mockSetPinHash.mockReset()
    mockSetPinHash.mockResolvedValue(undefined)
    mockListMembers.mockReset()
  })

  it('hashes new PIN and calls setMemberPinHash when no conflict', async () => {
    mockListMembers.mockResolvedValue([])
    const result = await updateMemberPin('member-uuid-1', 'pin1234')
    expect(result).toBe('ok')
    expect(mockSetPinHash).toHaveBeenCalledTimes(1)
    const [id, hash] = mockSetPinHash.mock.calls[0]
    expect(id).toBe('member-uuid-1')
    expect(await bcrypt.compare('pin1234', hash)).toBe(true)
  })

  it('returns conflict when another member already uses the same PIN', async () => {
    const existingHash = await bcrypt.hash('pin1234', 10)
    mockListMembers.mockResolvedValue([
      { id: 'member-uuid-2', name: 'Bob', slug: 'bob', pin_hash: existingHash },
    ])
    const result = await updateMemberPin('member-uuid-1', 'pin1234')
    expect(result).toBe('conflict')
    expect(mockSetPinHash).not.toHaveBeenCalled()
  })

  it('does not conflict with the member updating their own PIN', async () => {
    const existingHash = await bcrypt.hash('pin1234', 10)
    mockListMembers.mockResolvedValue([
      { id: 'member-uuid-1', name: 'Alice', slug: 'alice', pin_hash: existingHash },
    ])
    const result = await updateMemberPin('member-uuid-1', 'pin1234')
    expect(result).toBe('ok')
    expect(mockSetPinHash).toHaveBeenCalledTimes(1)
  })

  it('allows a PIN that matches a member with no hash set', async () => {
    mockListMembers.mockResolvedValue([
      { id: 'member-uuid-2', name: 'Bob', slug: 'bob', pin_hash: null },
    ])
    const result = await updateMemberPin('member-uuid-1', 'pin1234')
    expect(result).toBe('ok')
  })
})
