'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PasswordField from '@/components/PasswordField'

const BACKFILL_TYPES = [
  { value: 'vinyl', label: 'Vinyl', hint: 'artist sort name, tracklist, cover' },
  { value: 'book', label: 'Books', hint: 'description, ISBN, cover (OL · Google Books · KB)' },
  { value: 'comic', label: 'Comics', hint: 'description, cover (ComicVine)' },
  { value: 'lego', label: 'Lego', hint: 'theme, part count, year, cover (Rebrickable)' },
]

function BackfillButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState('')
  const [force, setForce] = useState(false)
  const [types, setTypes] = useState<string[]>(['vinyl', 'book', 'comic', 'lego'])

  function toggleType(value: string) {
    setTypes(prev => prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value])
  }

  async function run() {
    if (!types.length) return
    setStatus('running')
    setResult('')
    const params = new URLSearchParams({ types: types.join(',') })
    if (force) params.set('force', 'true')
    const res = await fetch(`/api/admin/backfill-sort?${params}`)
    const data = await res.json()
    if (res.ok) {
      const parts = Object.entries(data.summary as Record<string, { total: number; updated: number }>)
        .map(([k, v]) => `${k}: ${v.updated}/${v.total}`)
      setResult(parts.join(' · ') || 'Nothing to update')
      setStatus('done')
    } else {
      setResult(data.error ?? 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {BACKFILL_TYPES.map(t => (
          <label key={t.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={types.includes(t.value)} onChange={() => toggleType(t.value)} />
            <span>{t.label}</span>
            <span className="opacity-50 text-xs">({t.hint})</span>
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
        Force re-fetch (even if already filled)
      </label>
      <button onClick={run} disabled={status === 'running' || !types.length} className="btn-ghost text-sm self-start">
        {status === 'running' ? 'Running…' : 'Run backfill'}
      </button>
      {result && <p className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-green-600'}`}>{result}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [pinError, setPinError] = useState('')
  const [passError, setPassError] = useState('')
  const [pinSuccess, setPinSuccess] = useState(false)
  const [passSuccess, setPassSuccess] = useState(false)

  async function updateCredential(target: string, newValue: string, setError: (e: string) => void, setSuccess: (s: boolean) => void) {
    setError('')
    setSuccess(false)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, newValue }),
    })
    if (res.ok) {
      setSuccess(true)
    } else {
      const { error } = await res.json()
      setError(error ?? 'Something went wrong')
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-sm mx-auto flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/members')} className="btn-ghost text-sm">← Back</button>
        <h1 className="font-serif text-2xl font-bold">Settings</h1>
      </div>

      <section className="card p-6 flex flex-col gap-4">
        <h2 className="font-serif text-lg font-semibold">Change View PIN</h2>
        <p className="subtitle text-sm">Share this PIN with friends or family who just want to browse.</p>
        <PasswordField
          label="New view PIN (min 4 characters)"
          placeholder="New PIN"
          buttonLabel="Update PIN"
          error={pinError}
          onSubmit={v => updateCredential('view_pin_hash', v, setPinError, setPinSuccess)}
        />
        {pinSuccess && <p className="text-green-600 text-sm">PIN updated successfully.</p>}
      </section>

      <section className="card p-6 flex flex-col gap-4">
        <h2 className="font-serif text-lg font-semibold">Change Family Password</h2>
        <p className="subtitle text-sm">Used to add, edit, and delete items. Keep this private to the family.</p>
        <PasswordField
          label="New password (min 4 characters)"
          placeholder="New password"
          buttonLabel="Update Password"
          error={passError}
          onSubmit={v => updateCredential('family_password_hash', v, setPassError, setPassSuccess)}
        />
        {passSuccess && <p className="text-green-600 text-sm">Password updated successfully.</p>}
      </section>

      <section className="card p-6 flex flex-col gap-4">
        <h2 className="font-serif text-lg font-semibold">Data Backfill</h2>
        <p className="subtitle text-sm">Fetches missing data from external APIs for each collection type. Only fills gaps unless Force is enabled. Takes ~1–2 seconds per item.</p>
        <BackfillButton />
      </section>
    </main>
  )
}
