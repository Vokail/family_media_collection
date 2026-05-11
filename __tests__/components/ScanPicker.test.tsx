/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ScanPicker from '@/components/ScanPicker'

const defaultProps = {
  show: true,
  collection: 'book' as const,
  identifying: false,
  onClose: jest.fn(),
  onBarcodeRequest: jest.fn(),
  onCoverOCRRequest: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

describe('ScanPicker', () => {
  it('renders nothing when show=false', () => {
    const { container } = render(<ScanPicker {...defaultProps} show={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders sheet when show=true', () => {
    render(<ScanPicker {...defaultProps} />)
    expect(screen.getByText(/what do you want to scan/i)).toBeInTheDocument()
  })

  it('shows both barcode and OCR buttons for non-lego collection', () => {
    render(<ScanPicker {...defaultProps} collection="book" />)
    expect(screen.getByText(/scan barcode/i)).toBeInTheDocument()
    expect(screen.getByText(/scan cover/i)).toBeInTheDocument()
  })

  it('hides OCR button for lego collection', () => {
    render(<ScanPicker {...defaultProps} collection="lego" />)
    expect(screen.getByText(/scan barcode/i)).toBeInTheDocument()
    expect(screen.queryByText(/scan cover/i)).not.toBeInTheDocument()
  })

  it('calls onBarcodeRequest when barcode button is clicked', () => {
    render(<ScanPicker {...defaultProps} />)
    fireEvent.click(screen.getByText(/scan barcode/i))
    expect(defaultProps.onBarcodeRequest).toHaveBeenCalledTimes(1)
  })

  it('calls onCoverOCRRequest when cover button is clicked', () => {
    render(<ScanPicker {...defaultProps} />)
    fireEvent.click(screen.getByText(/scan cover/i))
    expect(defaultProps.onCoverOCRRequest).toHaveBeenCalledTimes(1)
  })

  it('disables OCR button while identifying', () => {
    render(<ScanPicker {...defaultProps} identifying={true} />)
    const coverBtn = screen.getByText(/scan cover/i)
    expect(coverBtn).toBeDisabled()
  })

  it('calls onClose when Cancel is clicked', () => {
    render(<ScanPicker {...defaultProps} />)
    fireEvent.click(screen.getByText(/cancel/i))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    render(<ScanPicker {...defaultProps} />)
    // The backdrop is the outermost div (first child of body)
    const backdrop = screen.getByText(/what do you want to scan/i).closest('[class*="fixed"]')!
    fireEvent.click(backdrop)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })
})
