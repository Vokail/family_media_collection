'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PasswordField from '@/components/PasswordField'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  async function handleLogin(password: string) {
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/members')
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Incorrect password or PIN')
    }
  }

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-serif font-bold">Our Collection</h1>
      <p className="subtitle">Enter the family password or view PIN</p>
      <PasswordField onSubmit={handleLogin} error={error} placeholder="Password or PIN" />
    </main>
  )
}
