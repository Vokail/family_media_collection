/**
 * @jest-environment jsdom
 *
 * Battery-drain regression: when the PWA is backgrounded the ZXing barcode
 * scanner MUST release its camera. The default cleanup only fires on unmount,
 * so without the visibilitychange listener the camera streams in the background.
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, act } from '@testing-library/react'

// Each call to decodeFromConstraints returns a fresh "controls" with a stop spy
const stopSpies: jest.Mock[] = []
const decodeSpy = jest.fn(async () => {
  const stop = jest.fn()
  stopSpies.push(stop)
  return { stop }
})

jest.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    decodeFromConstraints: decodeSpy,
  })),
}))

beforeEach(() => {
  decodeSpy.mockClear()
  stopSpies.length = 0
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

import BarcodeScanner from '@/components/BarcodeScanner'

describe('BarcodeScanner — release camera on backgrounding (battery)', () => {
  it('calls controls.stop() on unmount', async () => {
    let unmount: () => void = () => {}
    await act(async () => {
      const r = render(<BarcodeScanner onDetected={() => {}} onClose={() => {}} />)
      unmount = r.unmount
    })
    // Wait for the dynamic @zxing/browser import + decodeFromConstraints to resolve
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    unmount()
    expect(stopSpies[0]).toHaveBeenCalled()
  })

  it('stops the scanner when document.visibilityState becomes hidden', async () => {
    await act(async () => { render(<BarcodeScanner onDetected={() => {}} onClose={() => {}} />) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })

    expect(stopSpies[0]).toHaveBeenCalled()
  })

  it('re-starts decode when becoming visible again', async () => {
    await act(async () => { render(<BarcodeScanner onDetected={() => {}} onClose={() => {}} />) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    // decodeFromConstraints should have been called twice — initial start + restart
    expect(decodeSpy).toHaveBeenCalledTimes(2)
  })
})
