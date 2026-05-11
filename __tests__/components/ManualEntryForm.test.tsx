/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

jest.mock('@/components/PhotoCapture', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Toast', () => ({
  __esModule: true,
  useToast: () => ({ show: mockToastShow }),
}))

const mockToastShow = jest.fn()
const mockFetch = jest.fn()
global.fetch = mockFetch

import ManualEntryForm, { ManualEntryFormHandle } from '@/components/ManualEntryForm'

const defaultProps = {
  collection: 'book' as const,
  member: 'alice',
  scanCover: null,
  goToCollection: jest.fn(),
  onAdded: jest.fn(),
  scheduleNav: jest.fn(),
}

function renderForm(props = {}) {
  const ref = React.createRef<ManualEntryFormHandle>()
  const result = render(<ManualEntryForm ref={ref} {...defaultProps} {...props} />)
  return { ref, ...result }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'new-1', title: 'Test', creator: '' }) })
})

describe('ManualEntryForm — toggle', () => {
  it('is collapsed by default (no title input visible)', () => {
    renderForm()
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument()
  })

  it('expands when toggle button is clicked', () => {
    renderForm()
    fireEvent.click(screen.getByText(/not found\? add manually/i))
    expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
  })

  it('collapses again on second click', () => {
    renderForm()
    fireEvent.click(screen.getByText(/not found\? add manually/i))
    fireEvent.click(screen.getByText(/hide manual entry/i))
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument()
  })
})

describe('ManualEntryForm — imperative handle', () => {
  it('open() expands the form', async () => {
    const { ref } = renderForm()
    await act(async () => { ref.current?.open() })
    expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
  })

  it('prefill() sets isbn field', async () => {
    const { ref } = renderForm()
    await act(async () => { ref.current?.prefill({ isbn: '9781234567890' }) })
    const isbnInput = screen.getByPlaceholderText(/e\.g\. 9781234567890/i)
    expect(isbnInput).toHaveValue('9781234567890')
  })

  it('prefill() sets title and creator', async () => {
    const { ref } = renderForm()
    await act(async () => { ref.current?.prefill({ title: 'Dune', creator: 'Frank Herbert' }) })
    expect(screen.getByPlaceholderText('Title')).toHaveValue('Dune')
    expect(screen.getByPlaceholderText('Creator')).toHaveValue('Frank Herbert')
  })

  it('prefill() auto-fills cover filename in the button label', async () => {
    const { ref } = renderForm()
    const file = new File(['img'], 'cover.jpg', { type: 'image/jpeg' })
    await act(async () => { ref.current?.prefill({ cover: file }) })
    expect(screen.getByText('cover.jpg')).toBeInTheDocument()
  })
})

describe('ManualEntryForm — field behaviour', () => {
  it('shows ISBN field for book collection', () => {
    renderForm({ collection: 'book' })
    fireEvent.click(screen.getByText(/not found\? add manually/i))
    expect(screen.getByPlaceholderText(/9781234567890/i)).toBeInTheDocument()
  })

  it('hides ISBN field for vinyl collection', () => {
    renderForm({ collection: 'vinyl' })
    fireEvent.click(screen.getByText(/not found\? add manually/i))
    expect(screen.queryByPlaceholderText(/9781234567890/i)).not.toBeInTheDocument()
  })

  it('labels creator as Artist for vinyl', () => {
    renderForm({ collection: 'vinyl' })
    fireEvent.click(screen.getByText(/not found\? add manually/i))
    expect(screen.getByText('Artist')).toBeInTheDocument()
  })

  it('swap button exchanges title and creator values', () => {
    renderForm()
    fireEvent.click(screen.getByText(/not found\? add manually/i))
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Alpha' } })
    fireEvent.change(screen.getByPlaceholderText('Creator'), { target: { value: 'Beta' } })
    fireEvent.click(screen.getByTitle(/swap title and author/i))
    expect(screen.getByPlaceholderText('Title')).toHaveValue('Beta')
    expect(screen.getByPlaceholderText('Creator')).toHaveValue('Alpha')
  })

  it('auto-fills scanCover when form is opened via toggle', () => {
    const file = new File(['img'], 'scan.jpg', { type: 'image/jpeg' })
    renderForm({ scanCover: file })
    fireEvent.click(screen.getByText(/not found\? add manually/i))
    expect(screen.getByText('scan.jpg')).toBeInTheDocument()
  })
})

describe('ManualEntryForm — submission', () => {
  it('calls fetch and onAdded on successful add', async () => {
    const onAdded = jest.fn()
    const { ref } = renderForm({ onAdded })
    await act(async () => { ref.current?.prefill({ title: 'Dune' }) })
    await act(async () => {
      fireEvent.click(screen.getByText('Add to collection'))
    })
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/items/manual', expect.any(Object)))
    expect(onAdded).toHaveBeenCalledTimes(1)
  })

  it('shows toast on success', async () => {
    const { ref } = renderForm()
    await act(async () => { ref.current?.prefill({ title: 'Dune' }) })
    await act(async () => { fireEvent.click(screen.getByText('Add to collection')) })
    await waitFor(() => expect(mockToastShow).toHaveBeenCalledWith('Added to collection', 'success', expect.any(Object)))
  })

  it('shows error toast when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    const { ref } = renderForm()
    await act(async () => { ref.current?.prefill({ title: 'Dune' }) })
    await act(async () => { fireEvent.click(screen.getByText('Add to collection')) })
    await waitFor(() => expect(mockToastShow).toHaveBeenCalledWith('Could not add item', 'error'))
  })

  it('shows dupe confirmation on 409', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ existing: { id: 'x', title: 'Dune', creator: 'Herbert', year: 1965 } }),
    })
    const { ref } = renderForm()
    await act(async () => { ref.current?.prefill({ title: 'Dune' }) })
    await act(async () => { fireEvent.click(screen.getByText('Add to collection')) })
    await waitFor(() => expect(screen.getByText(/already in collection/i)).toBeInTheDocument())
  })

  it('"Add anyway" on dupe dialog re-submits with force=true', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ existing: { id: 'x', title: 'Dune', creator: 'Herbert', year: 1965 } }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'new-2', title: 'Dune', creator: '' }) })
    const { ref } = renderForm()
    await act(async () => { ref.current?.prefill({ title: 'Dune' }) })
    await act(async () => { fireEvent.click(screen.getByText('Add to collection')) })
    await waitFor(() => screen.getByText(/already in collection/i))
    await act(async () => { fireEvent.click(screen.getByText('Add anyway')) })
    await waitFor(() => {
      const body = mockFetch.mock.calls[1][1].body as FormData
      expect(body.get('force')).toBe('true')
    })
  })

  it('scheduleNav is called after successful add', async () => {
    const scheduleNav = jest.fn()
    const { ref } = renderForm({ scheduleNav })
    await act(async () => { ref.current?.prefill({ title: 'Dune' }) })
    await act(async () => { fireEvent.click(screen.getByText('Add to collection')) })
    await waitFor(() => expect(scheduleNav).toHaveBeenCalledTimes(1))
  })
})
