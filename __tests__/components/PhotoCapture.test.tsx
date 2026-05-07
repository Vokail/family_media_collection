/**
 * @jest-environment jsdom
 *
 * Battery-drain regression: when the PWA is backgrounded (visibilitychange →
 * hidden) we MUST release the camera stream. Otherwise the camera keeps running
 * in the background, which on iOS PWAs is a significant battery hit.
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, act } from '@testing-library/react'

// Mock-safe MediaStream — collects stop() calls so we can assert on them
function makeMockStream() {
  const stops: jest.Mock[] = []
  const tracks = [{ stop: jest.fn() }, { stop: jest.fn() }]
  for (const t of tracks) stops.push(t.stop as jest.Mock)
  const stream = { getTracks: () => tracks } as unknown as MediaStream
  return { stream, stops }
}

let mockStreamFactory: () => ReturnType<typeof makeMockStream>

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: jest.fn(async () => mockStreamFactory().stream),
    },
  })
  // Start visible
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
})

import PhotoCapture from '@/components/PhotoCapture'

describe('PhotoCapture — release camera on backgrounding (battery)', () => {
  it('stops all tracks on unmount', async () => {
    const mock = makeMockStream()
    mockStreamFactory = () => mock
    ;(navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValueOnce(mock.stream)

    let unmount: () => void = () => {}
    await act(async () => {
      const r = render(<PhotoCapture onCapture={() => {}} onClose={() => {}} />)
      unmount = r.unmount
    })
    // Let the getUserMedia promise resolve
    await act(async () => { await Promise.resolve() })

    unmount()
    // Each track's stop() must have been called
    expect(mock.stops.every(s => s.mock.calls.length >= 1)).toBe(true)
  })

  it('stops all tracks when document.visibilityState becomes hidden', async () => {
    const mock = makeMockStream()
    mockStreamFactory = () => mock
    ;(navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValueOnce(mock.stream)

    await act(async () => { render(<PhotoCapture onCapture={() => {}} onClose={() => {}} />) })
    await act(async () => { await Promise.resolve() })

    // Simulate the app being backgrounded
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })

    expect(mock.stops.every(s => s.mock.calls.length >= 1)).toBe(true)
  })

  it('re-acquires the stream when becoming visible again', async () => {
    const first = makeMockStream()
    const second = makeMockStream()
    ;(navigator.mediaDevices.getUserMedia as jest.Mock)
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream)

    mockStreamFactory = () => first
    await act(async () => { render(<PhotoCapture onCapture={() => {}} onClose={() => {}} />) })
    await act(async () => { await Promise.resolve() })

    // Hide → release
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })

    // Show → request a new stream
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { await Promise.resolve() })

    expect((navigator.mediaDevices.getUserMedia as jest.Mock).mock.calls.length).toBe(2)
  })
})
