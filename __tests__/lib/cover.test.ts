jest.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    storage: {
      from: () => ({
        upload: jest.fn().mockResolvedValue({ error: null }),
      }),
    },
  }),
}))

jest.mock('sharp', () => {
  const chain = {
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('imgdata')),
  }
  return jest.fn(() => chain)
})

global.fetch = jest.fn()

import { downloadCover, coverStorageKey } from '@/lib/cover'

describe('coverStorageKey (#127)', () => {
  it('strips the leading covers/ prefix', () => {
    expect(coverStorageKey('covers/member-1/uuid.jpg')).toBe('member-1/uuid.jpg')
  })

  it('returns the path unchanged when no covers/ prefix', () => {
    expect(coverStorageKey('member-1/uuid.jpg')).toBe('member-1/uuid.jpg')
  })

  it('handles two-level old-style paths', () => {
    expect(coverStorageKey('covers/manual/member-1/uuid.jpg')).toBe('manual/member-1/uuid.jpg')
  })
})

describe('downloadCover', () => {
  it('returns a storage path after downloading and uploading', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    const path = await downloadCover('https://example.com/cover.jpg', 'member-uuid-123')
    expect(path).toMatch(/^covers\/member-uuid-123\/.+\.jpg$/)
  })

  it('returns null when fetch fails', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false })
    const path = await downloadCover('https://example.com/missing.jpg', 'member-uuid-123')
    expect(path).toBeNull()
  })
})
