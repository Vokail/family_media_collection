jest.mock('@/lib/db/items', () => ({
  listItems: jest.fn(),
  createItem: jest.fn(),
}))
jest.mock('@/lib/db/members', () => ({
  getMemberBySlug: jest.fn(),
}))
jest.mock('@/lib/cover', () => ({
  downloadCover: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/apis/discogs', () => ({
  fetchVinylRelease: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/apis/openlibrary', () => ({
  fetchBookDescription: jest.fn().mockResolvedValue(null),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { GET, POST } from '@/app/api/items/route'
import { listItems, createItem } from '@/lib/db/items'
import { getMemberBySlug } from '@/lib/db/members'

const mockListItems = listItems as jest.Mock
const mockCreateItem = createItem as jest.Mock
const mockGetMember = getMemberBySlug as jest.Mock

const MEMBER = { id: 'member-uuid', name: 'Alice', slug: 'alice' }
const ITEM = {
  id: 'item-uuid', member_id: 'member-uuid', collection: 'vinyl',
  title: 'Abbey Road', creator: 'The Beatles', year: 1969,
  cover_path: null, is_wishlist: false, notes: null, created_at: '2024-01-01',
}

beforeEach(() => {
  mockListItems.mockReset()
  mockCreateItem.mockReset()
  mockGetMember.mockReset()
})

describe('GET /api/items', () => {
  it('returns 400 when member param is absent', async () => {
    const req = new Request('http://localhost/api/items?collection=vinyl')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid collection', async () => {
    const req = new Request('http://localhost/api/items?member=ewart&collection=invalid')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when DB throws', async () => {
    mockGetMember.mockRejectedValue(new Error('db error'))
    const req = new Request('http://localhost/api/items?member=alice&collection=vinyl')
    const res = await GET(req)
    expect(res.status).toBe(500)
  })

  it('returns 404 when member slug not found', async () => {
    mockGetMember.mockResolvedValue(null)
    const req = new Request('http://localhost/api/items?member=ghost&collection=vinyl')
    const res = await GET(req)
    expect(res.status).toBe(404)
  })

  it('returns items list for valid member and collection', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockListItems.mockResolvedValue([ITEM])
    const req = new Request('http://localhost/api/items?member=alice&collection=vinyl')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].title).toBe('Abbey Road')
  })

  it('passes isWishlist=true when wishlist param is set', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockListItems.mockResolvedValue([])
    const req = new Request('http://localhost/api/items?member=alice&collection=vinyl&wishlist=true')
    await GET(req)
    expect(mockListItems).toHaveBeenCalledWith('member-uuid', 'vinyl', true)
  })

  it('passes isWishlist=undefined when wishlist param is absent', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockListItems.mockResolvedValue([ITEM])
    const req = new Request('http://localhost/api/items?member=alice&collection=vinyl')
    await GET(req)
    expect(mockListItems).toHaveBeenCalledWith('member-uuid', 'vinyl', undefined)
  })
})

describe('POST /api/items', () => {
  it('returns 400 when title is missing', async () => {
    const req = new Request('http://localhost/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberSlug: 'ewart', collection: 'vinyl', title: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid collection', async () => {
    const req = new Request('http://localhost/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberSlug: 'ewart', collection: 'stamps', title: 'Test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when member not found', async () => {
    mockGetMember.mockResolvedValue(null)
    const req = new Request('http://localhost/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberSlug: 'ghost', collection: 'vinyl', title: 'Test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('creates an item and returns 201', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockCreateItem.mockResolvedValue(ITEM)
    const req = new Request('http://localhost/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberSlug: 'ewart', collection: 'vinyl',
        title: 'Abbey Road', creator: 'The Beatles', year: 1969,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.title).toBe('Abbey Road')
  })

  it('returns 500 when DB throws during create', async () => {
    mockGetMember.mockResolvedValue(MEMBER)
    mockCreateItem.mockRejectedValue(new Error('db error'))
    const req = new Request('http://localhost/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberSlug: 'alice', collection: 'vinyl', title: 'Test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
