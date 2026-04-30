jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))

const mockSharpInstance = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('resized-img')),
}
jest.mock('sharp', () => jest.fn(() => mockSharpInstance))

const mockFetch = jest.fn()
global.fetch = mockFetch

import { POST } from '@/app/api/ocr/route'
import { getSession } from '@/lib/session'
import { clearModelCache } from '@/lib/ocr-model-cache'

const mockGetSession = getSession as jest.Mock

// Model discovery response — one free vision model
const MODEL_LIST_RESPONSE = {
  ok: true,
  json: async () => ({
    data: [
      { id: 'some/vision-model:free', pricing: { prompt: '0' }, architecture: { modality: 'text+image->text' } },
    ],
  }),
}

// Successful OCR response
const ocrResponse = (content: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
})

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
  clearModelCache()
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
    // Models endpoint called first, then 400 on missing image
    mockFetch.mockResolvedValueOnce(MODEL_LIST_RESPONSE)
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
  })

  it('returns 503 when no free vision model is found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }), // empty model list
    })
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    expect(res.status).toBe(503)
  })

  it('returns series, title and creator from OpenRouter JSON response', async () => {
    mockFetch
      .mockResolvedValueOnce(MODEL_LIST_RESPONSE)
      .mockResolvedValueOnce(ocrResponse('{"series": "Warrior Cats", "title": "De Wildernis In", "creator": "Erin Hunter"}'))
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.series).toBe('Warrior Cats')
    expect(body.title).toBe('De Wildernis In')
    expect(body.creator).toBe('Erin Hunter')
  })

  it('returns empty series when book has no series', async () => {
    mockFetch
      .mockResolvedValueOnce(MODEL_LIST_RESPONSE)
      .mockResolvedValueOnce(ocrResponse('{"series": "", "title": "Dune", "creator": "Frank Herbert"}'))
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    const body = await res.json()
    expect(body.series).toBe('')
    expect(body.title).toBe('Dune')
  })

  it('strips markdown code fences from model response', async () => {
    mockFetch
      .mockResolvedValueOnce(MODEL_LIST_RESPONSE)
      .mockResolvedValueOnce(ocrResponse('```json\n{"series": "", "title": "1984", "creator": "George Orwell"}\n```'))
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    const body = await res.json()
    expect(body.title).toBe('1984')
    expect(body.creator).toBe('George Orwell')
  })

  it('returns raw text as title when model returns unparseable content', async () => {
    mockFetch
      .mockResolvedValueOnce(MODEL_LIST_RESPONSE)
      .mockResolvedValueOnce(ocrResponse('Sorry, I cannot read this image.'))
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toContain('Sorry')
    expect(body.creator).toBe('')
  })

  it('returns 502 when OpenRouter returns an error', async () => {
    mockFetch
      .mockResolvedValueOnce(MODEL_LIST_RESPONSE)
      .mockResolvedValueOnce({ ok: false, text: async () => 'Rate limit exceeded' })
    const res = await POST(makeRequest(new Blob(['img'], { type: 'image/jpeg' })))
    expect(res.status).toBe(502)
  })
})
