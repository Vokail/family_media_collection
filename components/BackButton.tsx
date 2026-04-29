'use client'
import { useRouter } from 'next/navigation'

export default function BackButton({ label = '← Back' }: { label?: string }) {
  const router = useRouter()
  return (
    <button onClick={() => router.back()} className="btn-ghost text-sm">
      {label}
    </button>
  )
}
