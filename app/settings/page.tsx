'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PasswordField from '@/components/PasswordField'

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
    </main>
  )
}
