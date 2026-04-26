const mockSingle = jest.fn()
const mockEq = jest.fn()
const mockSelect = jest.fn()
const mockUpsert = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({ from: mockFrom })),
}))

import { getSettingHash, upsertSettingHash } from '@/lib/db/settings'

beforeEach(() => {
  mockSingle.mockReset()
  mockEq.mockReset()
  mockSelect.mockReset()
  mockUpsert.mockReset()
  mockFrom.mockReset()
})

describe('getSettingHash', () => {
  it('returns the value when setting exists', async () => {
    mockSingle.mockResolvedValue({ data: { value: 'hashed-value' } })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await getSettingHash('view_pin_hash')
    expect(result).toBe('hashed-value')
    expect(mockEq).toHaveBeenCalledWith('key', 'view_pin_hash')
  })

  it('returns null when setting does not exist', async () => {
    mockSingle.mockResolvedValue({ data: null })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await getSettingHash('family_password_hash')
    expect(result).toBeNull()
  })
})

describe('upsertSettingHash', () => {
  it('upserts the key-value pair', async () => {
    mockUpsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ upsert: mockUpsert })

    await upsertSettingHash('view_pin_hash', 'new-hash')
    expect(mockUpsert).toHaveBeenCalledWith({ key: 'view_pin_hash', value: 'new-hash' })
  })
})
