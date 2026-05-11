const mockUpload = jest.fn().mockResolvedValue({ error: null })

jest.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
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

import { downloadCover, uploadImageBuffer, coverStorageKey } from '@/lib/cover'

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

describe('uploadImageBuffer (#141)', () => {
  beforeEach(() => mockUpload.mockResolvedValue({ error: null }))

  it('returns covers/<storagePath> on success', async () => {
    const path = await uploadImageBuffer(Buffer.from('imgdata'), 'manual/mem-1/uuid.jpg')
    expect(path).toBe('covers/manual/mem-1/uuid.jpg')
    expect(mockUpload).toHaveBeenCalledWith(
      'manual/mem-1/uuid.jpg',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/jpeg' }),
    )
  })

  it('returns null when upload errors', async () => {
    mockUpload.mockResolvedValueOnce({ error: new Error('storage full') })
    const path = await uploadImageBuffer(Buffer.from('imgdata'), 'manual/mem-1/uuid.jpg')
    expect(path).toBeNull()
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
