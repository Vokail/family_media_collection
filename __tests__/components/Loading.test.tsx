/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'
import Loading from '@/app/loading'

describe('Loading', () => {
  it('renders the app icon', () => {
    const { container } = render(<Loading />)
    const img = container.querySelector('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/icon-192.png')
  })

  it('uses the warm background colour', () => {
    const { container } = render(<Loading />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.backgroundColor).toContain('#f5ede0')
  })

  it('fills the full viewport height', () => {
    const { container } = render(<Loading />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.minHeight).toBe('100svh')
  })
})
