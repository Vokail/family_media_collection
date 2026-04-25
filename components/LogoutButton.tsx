'use client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
  }
  return <button onClick={logout} className="btn-ghost text-xs">Log out</button>
}
