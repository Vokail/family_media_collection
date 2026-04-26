const mockLimit = jest.fn().mockResolvedValue({ data: [{ id: 'x' }], error: null })
const mockSelect = jest.fn().mockReturnValue({ limit: mockLimit })
const mockFrom = jest.fn().mockReturnValue({ select: mockSelect })

jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({ from: mockFrom })),
}))

import { GET } from '@/app/api/ping/route'

describe('GET /api/ping', () => {
  it('returns ok:true with a timestamp', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.ts).toBe('string')
    expect(new Date(body.ts).getTime()).toBeGreaterThan(0)
  })

  it('pings the members table to keep Supabase alive', async () => {
    await GET()
    expect(mockFrom).toHaveBeenCalledWith('members')
    expect(mockSelect).toHaveBeenCalledWith('id')
    expect(mockLimit).toHaveBeenCalledWith(1)
  })
})
