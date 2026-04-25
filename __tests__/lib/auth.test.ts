import bcrypt from 'bcryptjs'

jest.mock('@/lib/db/settings', () => ({
  getSettingHash: jest.fn(),
  upsertSettingHash: jest.fn(),
}))

import { getSettingHash, upsertSettingHash } from '@/lib/db/settings'
import { resolveRole, updateCredential } from '@/lib/auth'

const mockGetHash = getSettingHash as jest.Mock
const mockUpsert = upsertSettingHash as jest.Mock

describe('resolveRole', () => {
  it('returns editor when input matches family password', async () => {
    const hash = await bcrypt.hash('secret', 10)
    mockGetHash.mockReset()
    mockGetHash.mockImplementation(async (key: string) =>
      key === 'family_password_hash' ? hash : null
    )
    const role = await resolveRole('secret')
    expect(role).toBe('editor')
  })

  it('returns viewer when input matches view pin', async () => {
    const hash = await bcrypt.hash('1234', 10)
    mockGetHash.mockReset()
    mockGetHash.mockImplementation(async (key: string) =>
      key === 'view_pin_hash' ? hash : null
    )
    const role = await resolveRole('1234')
    expect(role).toBe('viewer')
  })

  it('returns null when input matches nothing', async () => {
    mockGetHash.mockReset()
    mockGetHash.mockResolvedValue(null)
    const role = await resolveRole('wrong')
    expect(role).toBeNull()
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
