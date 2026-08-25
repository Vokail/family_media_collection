'use client'
import { useState } from 'react'

interface Props {
  label?: string
  onSubmit: (value: string) => Promise<void>
  error?: string
  placeholder?: string
  buttonLabel?: string
}

export default function PasswordField({ label, onSubmit, error, placeholder = 'Password', buttonLabel = 'Enter' }: Props) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await onSubmit(value)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-xs">
      {label && <label className="label">{label}</label>}
      <input
        type="password"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="input"
        // Labels the keyboard's return key "Go" so the form can be submitted
        // without reaching the button at all — the button may still sit under
        // the on-screen keyboard on a short screen (#150).
        enterKeyHint="go"
        required
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? '…' : buttonLabel}
      </button>
    </form>
  )
}
