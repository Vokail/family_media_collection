jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

const mockFetch = jest.fn()
global.fetch = mockFetch

import { POST } from '@/app/api/ocr/route'
import { getSession } from '@/lib/session'

const mockGetSession = getSession as jest.Mock

function makeRequest(file?: Blob) {
  const form = new FormData()
  if (file) form.append('image', file, 'cover.jpg')
  return new Request('http://localhost/api/ocr', { method: 'POST', body: form })
}

beforeEach(() => {
  mockGetSession.mockReset()
  mockFetch.mockReset()
  mockGetSession.mockResolvedValue({ role: 'editor' })
  process.env.OPENROUTER_API_KEY = 'test-key'
})

describe('POST /api/ocr', () => {
  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue({ role: undefined })
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    expect(res.status).toBe(401)
  })

  it('returns 503 when OPENROUTER_API_KEY is not set', async () => {
    delete process.env.OPENROUTER_API_KEY
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    expect(res.status).toBe(503)
  })

  it('returns 400 when no image is provided', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns title and creator from OpenRouter JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"title": "Dune", "creator": "Frank Herbert"}' } }],
      }),
    })
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('Dune')
    expect(body.creator).toBe('Frank Herbert')
  })

  it('strips markdown code fences from model response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n{"title": "1984", "creator": "George Orwell"}\n```' } }],
      }),
    })
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    const body = await res.json()
    expect(body.title).toBe('1984')
    expect(body.creator).toBe('George Orwell')
  })

  it('returns raw text as title when model returns unparseable content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Sorry, I cannot read this image.' } }],
      }),
    })
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toContain('Sorry')
    expect(body.creator).toBe('')
  })

  it('returns 502 when OpenRouter returns an error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Rate limit exceeded' })
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    expect(res.status).toBe(502)
  })
})
