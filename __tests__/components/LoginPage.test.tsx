/**
 * @jest-environment jsdom
 *
 * Regression cover for #150 — on an iOS PWA the on-screen keyboard covered the
 * Enter button and there was no way to reach it.
 */
import '@testing-library/jest-dom'
import { render, screen, fireEvent, act } from '@testing-library/react'
import LoginPage from '@/app/page'
import PasswordField from '@/components/PasswordField'

describe('login page layout (#150)', () => {
  it('does not pin the page, so the keyboard cannot trap content off-screen', () => {
    const { container } = render(<LoginPage />)
    const main = container.querySelector('main')!

    // `fixed inset-0` was the bug: a fixed container has no scrollable overflow,
    // so anything the keyboard covers is unreachable — dismissing the keyboard
    // was the only way to press Enter.
    expect(main.className).not.toMatch(/\bfixed\b/)
    expect(main.className).not.toMatch(/\binset-0\b/)
  })

  it('still fills the viewport so the form stays centred on a tall screen', () => {
    const { container } = render(<LoginPage />)
    const main = container.querySelector('main')!
    expect(main.className).toMatch(/min-h-screen/)
    // dvh tracks the visible area on modern iOS; min-h-screen is the fallback.
    expect(main.className).toMatch(/100dvh/)
    expect(main.className).toMatch(/justify-center/)
  })

  it('renders the password field and a submit button', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('Password or PIN')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
  })
})

describe('PasswordField keyboard affordance (#150)', () => {
  it('labels the return key so the form can be submitted without the button', () => {
    // On a short screen the button can still sit under the keyboard; "Go" on the
    // return key means the user never has to reach it.
    render(<PasswordField onSubmit={async () => {}} placeholder="Password or PIN" />)
    expect(screen.getByPlaceholderText('Password or PIN')).toHaveAttribute('enterkeyhint', 'go')
  })

  it('submits the typed value through the form', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    const { container } = render(<PasswordField onSubmit={onSubmit} />)
    const input = container.querySelector('input')!
    fireEvent.change(input, { target: { value: 'hunter2' } })
    // Wrapped: handleSubmit awaits onSubmit and then flips `loading` back off.
    await act(async () => { fireEvent.submit(container.querySelector('form')!) })
    expect(onSubmit).toHaveBeenCalledWith('hunter2')
  })
})
