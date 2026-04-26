'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PasswordField from '@/components/PasswordField'

function BackfillButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState('')
  const [force, setForce] = useState(false)

  async function run() {
    setStatus('running')
    setResult('')
    const res = await fetch(`/api/admin/backfill-sort${force ? '?force=true' : ''}`)
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
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} className="rounded" />
        Force re-fetch all items (even if already filled)
      </label>
      <button onClick={run} disabled={status === 'running'} className="btn-ghost text-sm self-start">
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
        <p className="subtitle text-sm">Re-fetch missing data from external APIs: sort names + tracklists for vinyl, descriptions for books. Takes ~2 seconds per item.</p>
        <BackfillButton />
      </section>
    </main>
  )
}
