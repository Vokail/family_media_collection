'use client'
import { useState } from 'react'
import type { CollectionType } from '@/lib/types'

const ALL_COLLECTIONS: { value: CollectionType; label: string; emoji: string }[] = [
  { value: 'vinyl', label: 'Vinyl', emoji: '🎵' },
  { value: 'book',  label: 'Books', emoji: '📚' },
  { value: 'comic', label: 'Comics', emoji: '🦸' },
  { value: 'lego',  label: 'Lego',  emoji: '🧱' },
]

interface Props {
  memberId: string
  memberName: string
  enabledCollections: CollectionType[]
}

export default function ProfilePinForm({ memberId, memberName, enabledCollections: initial }: Props) {
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)

  const [enabled, setEnabled] = useState<CollectionType[]>(initial)
  const [colError, setColError] = useState('')
  const [colSuccess, setColSuccess] = useState(false)
  const [colLoading, setColLoading] = useState(false)

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPinError('')
    setPinSuccess(false)
    if (pin.length < 4) { setPinError('PIN must be at least 4 digits'); return }
    if (!/^\d+$/.test(pin)) { setPinError('PIN must contain digits only'); return }
    setPinLoading(true)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'member_pin', newValue: pin, memberId }),
    })
    setPinLoading(false)
    if (res.ok) { setPinSuccess(true); setPin('') }
    else { const d = await res.json(); setPinError(d.error ?? 'Something went wrong') }
  }

  function toggleCollection(col: CollectionType) {
    setEnabled(prev => {
      if (prev.includes(col)) {
        if (prev.length === 1) { setColError('At least one collection must stay enabled'); return prev }
        setColError('')
        return prev.filter(c => c !== col)
      }
      setColError('')
      return [...prev, col]
    })
  }

  async function saveCollections() {
    setColError('')
    setColSuccess(false)
    setColLoading(true)
    const res = await fetch('/api/members/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled_collections: enabled }),
    })
    setColLoading(false)
    if (res.ok) setColSuccess(true)
    else { const d = await res.json(); setColError(d.error ?? 'Something went wrong') }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* PIN section */}
      <div className="card p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-lg font-semibold">PIN — {memberName}</h2>
          <p className="subtitle text-sm mt-1">Set a personal PIN to log in directly as yourself.</p>
        </div>
        <form onSubmit={handlePinSubmit} className="flex flex-col gap-3">
          <div>
            <label className="label mb-1 block">New PIN (min 4 digits)</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input"
              placeholder="New PIN"
              value={pin}
              onChange={e => { setPin(e.target.value); setPinError(''); setPinSuccess(false) }}
              required
              minLength={4}
            />
          </div>
          {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
          {pinSuccess && <p className="text-sm" style={{ color: 'var(--accent)' }}>PIN updated successfully.</p>}
          <button type="submit" disabled={pinLoading} className="btn-primary">
            {pinLoading ? '…' : 'Update PIN'}
          </button>
        </form>
      </div>

      {/* Collections section */}
      <div className="card p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-lg font-semibold">My Collections</h2>
          <p className="subtitle text-sm mt-1">Choose which collections appear in your tabs.</p>
        </div>
        <div className="flex flex-col gap-2">
          {ALL_COLLECTIONS.map(({ value, label, emoji }) => {
            const on = enabled.includes(value)
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleCollection(value)}
                className="flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                style={{
                  background: on ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-card))' : 'var(--bg-card)',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <span className="text-xl">{emoji}</span>
                <span className="flex-1 font-medium text-sm">{label}</span>
                <span className="text-lg" style={{ color: on ? 'var(--accent)' : 'var(--border)' }}>
                  {on ? '●' : '○'}
                </span>
              </button>
            )
          })}
        </div>
        {colError && <p className="text-red-500 text-sm">{colError}</p>}
        {colSuccess && <p className="text-sm" style={{ color: 'var(--accent)' }}>Collections saved.</p>}
        <button onClick={saveCollections} disabled={colLoading} className="btn-primary">
          {colLoading ? '…' : 'Save collections'}
        </button>
      </div>
    </div>
  )
}
