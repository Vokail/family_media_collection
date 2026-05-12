/**
 * @jest-environment jsdom
 *
 * Unit tests for LegoDetailModal.
 * Covers: dialog semantics, header fields, set-number badge,
 * num_parts pill (present / absent), and close behaviour.
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

import LegoDetailModal from '@/components/LegoDetailModal'
import type { SearchResult } from '@/lib/types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const legoResult: SearchResult = {
  external_id: '75192',
  title: 'Millennium Falcon',
  creator: 'LEGO',
  year: 2017,
  cover_url: null,
  source: 'rebrickable',
  num_parts: 7541,
}

const noop = () => {}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LegoDetailModal — dialog semantics', () => {
  it('renders a dialog with role="dialog"', () => {
    render(<LegoDetailModal result={legoResult} onClose={noop} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('aria-label includes the result title', () => {
    render(<LegoDetailModal result={legoResult} onClose={noop} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Millennium Falcon details')
  })
})

describe('LegoDetailModal — header fields', () => {
  it('shows result.title', () => {
    render(<LegoDetailModal result={legoResult} onClose={noop} />)
    expect(screen.getByText('Millennium Falcon')).toBeInTheDocument()
  })

  it('shows result.creator', () => {
    render(<LegoDetailModal result={legoResult} onClose={noop} />)
    expect(screen.getByText(/LEGO/)).toBeInTheDocument()
  })
})

describe('LegoDetailModal — set-number badge', () => {
  it('shows #external_id as a badge', () => {
    render(<LegoDetailModal result={legoResult} onClose={noop} />)
    expect(screen.getByText('#75192')).toBeInTheDocument()
  })

  it('badge reflects the actual external_id value', () => {
    render(<LegoDetailModal result={{ ...legoResult, external_id: '10179' }} onClose={noop} />)
    expect(screen.getByText('#10179')).toBeInTheDocument()
  })
})

describe('LegoDetailModal — num_parts pill', () => {
  it('shows pieces pill with formatted count when num_parts is present', () => {
    render(<LegoDetailModal result={legoResult} onClose={noop} />)
    // toLocaleString output varies by ICU data — match the numeric portion
    expect(screen.getByText(/7[,.]?541 pieces/)).toBeInTheDocument()
  })

  it('pill text includes the brick emoji', () => {
    render(<LegoDetailModal result={legoResult} onClose={noop} />)
    // The emoji appears in nested spans — getAllByText avoids multiple-match errors
    expect(screen.getAllByText(/🧱/).length).toBeGreaterThan(0)
  })

  it('does NOT show pieces pill when num_parts is null', () => {
    render(<LegoDetailModal result={{ ...legoResult, num_parts: null }} onClose={noop} />)
    expect(screen.queryByText(/pieces/)).not.toBeInTheDocument()
  })

  it('does NOT show pieces pill when num_parts is undefined', () => {
    render(<LegoDetailModal result={{ ...legoResult, num_parts: undefined }} onClose={noop} />)
    expect(screen.queryByText(/pieces/)).not.toBeInTheDocument()
  })
})

describe('LegoDetailModal — close behaviour', () => {
  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    render(<LegoDetailModal result={legoResult} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop (dialog) is clicked', () => {
    const onClose = jest.fn()
    render(<LegoDetailModal result={legoResult} onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onClose when inner card content is clicked', () => {
    const onClose = jest.fn()
    render(<LegoDetailModal result={legoResult} onClose={onClose} />)
    fireEvent.click(screen.getByText('Millennium Falcon'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
