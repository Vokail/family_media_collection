import { searchLego, lookupLegoBySetNum, lookupLegoByEAN } from '@/lib/apis/rebrickable'

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

process.env.REBRICKABLE_API_KEY = 'test-key'

const THEMES_RESPONSE = {
  ok: true,
  json: async () => ({
    results: [
      { id: 1, name: 'Star Wars' },
      { id: 2, name: 'Technic and CUUSOO' },
    ],
  }),
}

beforeEach(() => mockFetch.mockReset())

describe('searchLego', () => {
  it('returns mapped results with theme name', async () => {
    mockFetch
      .mockResolvedValueOnce(THEMES_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, set_img_url: 'https://example.com/img.jpg', theme_id: 1 },
          ],
        }),
      })

    const results = await searchLego('Falcon')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      external_id: '75192-1',
      title: 'Millennium Falcon',
      creator: 'Star Wars',
      year: 2017,
      cover_url: 'https://example.com/img.jpg',
      source: 'rebrickable',
    })
  })

  it('strips "and CUUSOO" from theme names', async () => {
    mockFetch
      .mockResolvedValueOnce(THEMES_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ set_num: '42115-1', name: 'Lamborghini', year: 2020, set_img_url: null, theme_id: 2 }],
        }),
      })

    const results = await searchLego('Lamborghini')
    expect(results[0].creator).toBe('Technic')
  })

  it('returns empty array when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const results = await searchLego('test')
    expect(results).toEqual([])
  })

  it('falls back to "LEGO" when theme_id is unknown', async () => {
    mockFetch
      .mockResolvedValueOnce(THEMES_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ set_num: '99999-1', name: 'Mystery Set', year: 2023, set_img_url: null, theme_id: 999 }],
        }),
      })

    const results = await searchLego('mystery')
    expect(results[0].creator).toBe('LEGO')
  })
})

describe('lookupLegoBySetNum', () => {
  it('returns result for an exact set number', async () => {
    mockFetch
      .mockResolvedValueOnce(THEMES_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ set_num: '75192-1', name: 'Millennium Falcon', year: 2017, set_img_url: null, theme_id: 1 }),
      })

    const result = await lookupLegoBySetNum('75192-1')
    expect(result).not.toBeNull()
    expect(result!.external_id).toBe('75192-1')
  })

  it('retries with "-1" suffix when exact lookup fails', async () => {
    mockFetch
      .mockResolvedValueOnce(THEMES_RESPONSE)
      .mockResolvedValueOnce({ ok: false })  // 75192 fails
      .mockResolvedValueOnce({              // 75192-1 succeeds
        ok: true,
        json: async () => ({ set_num: '75192-1', name: 'Millennium Falcon', year: 2017, set_img_url: null, theme_id: 1 }),
      })

    const result = await lookupLegoBySetNum('75192')
    expect(result).not.toBeNull()
    expect(result!.external_id).toBe('75192-1')
  })

  it('returns null when all variants fail', async () => {
    mockFetch
      .mockResolvedValueOnce(THEMES_RESPONSE)
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })

    const result = await lookupLegoBySetNum('00000')
    expect(result).toBeNull()
  })
})

describe('lookupLegoByEAN', () => {
  const SET_RESPONSE = {
    ok: true,
    json: async () => ({ set_num: '75192-1', name: 'Millennium Falcon', year: 2017, set_img_url: 'https://example.com/img.jpg', theme_id: 1 }),
  }

  it('resolves EAN via model field and returns Rebrickable metadata', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ model: '75192', title: 'LEGO Star Wars Millennium Falcon 75192', brand: 'LEGO' }] }),
      })
      .mockResolvedValueOnce(THEMES_RESPONSE)
      .mockResolvedValueOnce(SET_RESPONSE)

    const result = await lookupLegoByEAN('5702016110319')
    expect(result).not.toBeNull()
    expect(result!.external_id).toBe('75192-1')
    expect(result!.title).toBe('Millennium Falcon')
  })

  it('falls back to title regex when model field is absent', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ model: '', title: 'LEGO Technic Land Rover 42110', brand: 'LEGO' }] }),
      })
      .mockResolvedValueOnce(THEMES_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ set_num: '42110-1', name: 'Land Rover Defender', year: 2019, set_img_url: null, theme_id: 2 }),
      })

    const result = await lookupLegoByEAN('5702016370713')
    expect(result).not.toBeNull()
    expect(result!.external_id).toBe('42110-1')
  })

  it('returns null when upcitemdb returns no items', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    })

    const result = await lookupLegoByEAN('0000000000000')
    expect(result).toBeNull()
  })

  it('returns null when upcitemdb fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })
    const result = await lookupLegoByEAN('5702016110319')
    expect(result).toBeNull()
  })

  it('returns null when model field is not a valid set number', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ model: 'ABC', title: 'Some product', brand: 'Other' }] }),
    })
    const result = await lookupLegoByEAN('1234567890123')
    expect(result).toBeNull()
  })
})
