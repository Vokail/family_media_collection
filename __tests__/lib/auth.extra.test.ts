import bcrypt from 'bcryptjs'

jest.mock('@/lib/db/settings', () => ({
  getSettingHash: jest.fn(),
  upsertSettingHash: jest.fn(),
}))

import { getSettingHash, upsertSettingHash } from '@/lib/db/settings'
import { seedCredentialsIfMissing } from '@/lib/auth'

const mockGetHash = getSettingHash as jest.Mock
const mockUpsert = upsertSettingHash as jest.Mock

beforeEach(() => {
  mockGetHash.mockReset()
  mockUpsert.mockReset()
  process.env.INITIAL_VIEW_PIN = '1234'
  process.env.INITIAL_FAMILY_PASSWORD = 'secret'
})

describe('seedCredentialsIfMissing', () => {
  it('does nothing when credentials already exist', async () => {
    mockGetHash.mockResolvedValue('existing-hash')
    await seedCredentialsIfMissing()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('upserts both pin and password hashes when none exist', async () => {
    mockGetHash.mockResolvedValue(null)
    mockUpsert.mockResolvedValue(undefined)

    await seedCredentialsIfMissing()

    expect(mockUpsert).toHaveBeenCalledTimes(2)

    const calls = mockUpsert.mock.calls
    const pinCall = calls.find(([key]: [string]) => key === 'view_pin_hash')
    const passCall = calls.find(([key]: [string]) => key === 'family_password_hash')

    expect(pinCall).toBeDefined()
    expect(passCall).toBeDefined()

    expect(await bcrypt.compare('1234', pinCall![1])).toBe(true)
    expect(await bcrypt.compare('secret', passCall![1])).toBe(true)
  })
})
