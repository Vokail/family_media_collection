/**
 * @jest-environment jsdom
 *
 * Unit tests for VinylDetailModal.
 * Covers: dialog semantics, header fields, metadata pills, genre override,
 * loading skeleton, tracklist rendering, empty tracklist, and close behaviour.
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

import VinylDetailModal from '@/components/VinylDetailModal'
import type { SearchResult } from '@/lib/types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const baseResult: SearchResult = {
  external_id: 'discogs-123',
  title: 'Dark Side of the Moon',
  creator: 'Pink Floyd',
  year: 1973,
  cover_url: null,
  source: 'discogs',
  format: 'LP',
  label: 'Harvest',
  country: 'UK',
  catno: 'SHVL 804',
  genres: 'Rock',
  styles: 'Psychedelic Rock',
}

const noop = () => {}

function mkFetch(body: object) {
  return jest.fn().mockResolvedValue({ ok: true, json: async () => body })
}

const vinylDetail = {
  tracklist: [
    { position: 'A1', title: 'Speak to Me', duration: '1:30' },
    { position: 'A2', title: 'Breathe', duration: '2:43' },
  ],
  sortName: null,
  genres: 'Progressive Rock',
  styles: 'Art Rock',
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('VinylDetailModal — dialog semantics', () => {
  beforeEach(() => { global.fetch = mkFetch(vinylDetail) })

  it('renders a dialog with role="dialog"', async () => {
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('aria-label includes the result title', async () => {
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Dark Side of the Moon details')
  })
})

describe('VinylDetailModal — header fields', () => {
  beforeEach(() => { global.fetch = mkFetch(vinylDetail) })

  it('shows result.title', async () => {
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByText('Dark Side of the Moon')).toBeInTheDocument()
  })

  it('shows result.creator', async () => {
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByText('Pink Floyd')).toBeInTheDocument()
  })

  it('shows result.year', async () => {
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByText('1973')).toBeInTheDocument()
  })
})

describe('VinylDetailModal — metadata pills', () => {
  beforeEach(() => { global.fetch = mkFetch(vinylDetail) })

  it('shows format pill', async () => {
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByText('LP')).toBeInTheDocument()
  })

  it('shows label pill', async () => {
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByText('Harvest')).toBeInTheDocument()
  })

  it('shows country pill', async () => {
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByText('UK')).toBeInTheDocument()
  })

  it('shows catno pill', async () => {
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByText('SHVL 804')).toBeInTheDocument()
  })

  it('omits format pill when format is absent', async () => {
    global.fetch = mkFetch(vinylDetail)
    await act(async () => { render(<VinylDetailModal result={{ ...baseResult, format: null }} onClose={noop} />) })
    expect(screen.queryByText('LP')).not.toBeInTheDocument()
  })
})

describe('VinylDetailModal — genre pills', () => {
  it('shows result.genres before detail loads', () => {
    // fetch never resolves → detail stays null
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<VinylDetailModal result={baseResult} onClose={noop} />)
    expect(screen.getByText('Rock')).toBeInTheDocument()
  })

  it('shows detail.genres overriding result.genres after load', async () => {
    global.fetch = mkFetch(vinylDetail) // detail.genres = 'Progressive Rock'
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByText('Progressive Rock')).toBeInTheDocument()
    expect(screen.queryByText('Rock')).not.toBeInTheDocument()
  })
})

describe('VinylDetailModal — loading skeleton', () => {
  it('renders skeleton rows while fetch is pending', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))
    render(<VinylDetailModal result={baseResult} onClose={noop} />)
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('removes skeleton rows after detail loads', async () => {
    global.fetch = mkFetch(vinylDetail)
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(document.querySelectorAll('.animate-pulse').length).toBe(0)
  })
})

describe('VinylDetailModal — tracklist', () => {
  it('renders track position, title, and duration after load', async () => {
    global.fetch = mkFetch(vinylDetail)
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('Speak to Me')).toBeInTheDocument()
    expect(screen.getByText('1:30')).toBeInTheDocument()
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(screen.getByText('Breathe')).toBeInTheDocument()
    expect(screen.getByText('2:43')).toBeInTheDocument()
  })

  it('renders "No tracklist available" when tracklist is empty', async () => {
    global.fetch = mkFetch({ ...vinylDetail, tracklist: [] })
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.getByText('No tracklist available')).toBeInTheDocument()
  })

  it('does NOT show "No tracklist available" when tracklist has items', async () => {
    global.fetch = mkFetch(vinylDetail)
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={noop} />) })
    expect(screen.queryByText('No tracklist available')).not.toBeInTheDocument()
  })
})

describe('VinylDetailModal — close behaviour', () => {
  beforeEach(() => { global.fetch = mkFetch(vinylDetail) })

  it('calls onClose when close button is clicked', async () => {
    const onClose = jest.fn()
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={onClose} />) })
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop (dialog) is clicked', async () => {
    const onClose = jest.fn()
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={onClose} />) })
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when inner card content is clicked', async () => {
    const onClose = jest.fn()
    await act(async () => { render(<VinylDetailModal result={baseResult} onClose={onClose} />) })
    fireEvent.click(screen.getByText('Dark Side of the Moon'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
