'use client'
import { useState } from 'react'

interface Props {
  memberId: string
  memberName: string
}

export default function ProfilePinForm({ memberId, memberName }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (pin.length < 4) {
      setError('PIN must be at least 4 characters')
      return
    }
    setLoading(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'member_pin', newValue: pin, memberId }),
    })
    setLoading(false)
    if (res.ok) {
      setSuccess(true)
      setPin('')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
    }
  }

  return (
    <div className="card p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-lg font-semibold">Your PIN — {memberName}</h2>
        <p className="subtitle text-sm mt-1">Set a personal PIN to log in directly as yourself.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="label mb-1 block">New PIN (min 4 characters)</label>
          <input
            type="password"
            inputMode="numeric"
            className="input"
            placeholder="New PIN"
            value={pin}
            onChange={e => { setPin(e.target.value); setError(''); setSuccess(false) }}
            required
            minLength={4}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-sm" style={{ color: 'var(--accent)' }}>PIN updated successfully.</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? '…' : 'Update PIN'}
        </button>
      </form>
    </div>
  )
}
