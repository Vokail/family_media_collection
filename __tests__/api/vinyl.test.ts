jest.mock('@/lib/session', () => ({ getSession: jest.fn() }))
jest.mock('@/lib/apis/discogs', () => ({ fetchVinylRelease: jest.fn() }))

import { GET } from '@/app/api/vinyl/[id]/route'
import { getSession } from '@/lib/session'
import { fetchVinylRelease } from '@/lib/apis/discogs'

const mockGetSession = getSession as jest.Mock
const mockFetchRelease = fetchVinylRelease as jest.Mock

function makeGet(id: string) {
  return [
    new Request(`http://localhost/api/vinyl/${id}`),
    { params: Promise.resolve({ id }) },
  ] as const
}

beforeEach(() => {
  mockGetSession.mockReset()
  mockFetchRelease.mockReset()
})

describe('GET /api/vinyl/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue({ role: undefined })
    const [req, ctx] = makeGet('12345')
    const res = await GET(req, ctx)
    expect(res.status).toBe(401)
  })

  it('returns release data including genres and styles for authenticated users', async () => {
    mockGetSession.mockResolvedValue({ role: 'viewer' })
    mockFetchRelease.mockResolvedValue({
      tracklist: [{ position: 'A1', title: 'Track 1', duration: '3:00' }],
      sortName: 'Floyd, Pink',
      genres: 'Rock',
      styles: 'Psychedelic Rock, Progressive Rock',
    })
    const [req, ctx] = makeGet('12345')
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sortName).toBe('Floyd, Pink')
    expect(data.tracklist).toHaveLength(1)
    expect(data.genres).toBe('Rock')
    expect(data.styles).toBe('Psychedelic Rock, Progressive Rock')
    expect(mockFetchRelease).toHaveBeenCalledWith('12345')
  })

  it('returns release data for any authenticated role (editor)', async () => {
    mockGetSession.mockResolvedValue({ role: 'editor' })
    mockFetchRelease.mockResolvedValue({ tracklist: [], sortName: null, genres: null, styles: null })
    const [req, ctx] = makeGet('99999')
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.genres).toBeNull()
    expect(data.styles).toBeNull()
  })
})
