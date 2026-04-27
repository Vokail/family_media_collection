'use client'

export default function LogoutButton() {
  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/'
  }
  return <button onClick={logout} className="btn-ghost text-xs">Log out</button>
}
