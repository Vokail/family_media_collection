'use client'
import { useRef, useState } from 'react'

interface Props {
  memberName: string
  avatarPath: string | null
  supabaseUrl: string
}

export default function AvatarUpload({ memberName, avatarPath: initialPath, supabaseUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [avatarPath, setAvatarPath] = useState(initialPath)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const avatarUrl = avatarPath
    ? `${supabaseUrl}/storage/v1/object/public/${avatarPath}?t=${Date.now()}`
    : null

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)

    const form = new FormData()
    form.append('avatar', file)

    const res = await fetch('/api/members/profile', { method: 'PUT', body: form })
    setUploading(false)

    if (res.ok) {
      const data = await res.json()
      setAvatarPath(data.avatar_path)
    } else {
      setError('Upload failed — please try again')
    }

    // Reset input so the same file can be selected again if needed
    e.target.value = ''
  }

  const initial = memberName[0].toUpperCase()

  return (
    <div className="card p-6 flex flex-col items-center gap-4">
      <h2 className="font-serif text-lg font-semibold self-start">Profile Photo</h2>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative group focus:outline-none"
        aria-label="Change profile photo"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={memberName}
            className="w-24 h-24 rounded-full object-cover shadow-md"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-serif font-bold text-white shadow-md"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {initial}
          </div>
        )}

        {/* Overlay on hover / while uploading */}
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center transition-opacity"
          style={{
            background: 'rgba(0,0,0,0.45)',
            opacity: uploading ? 1 : 0,
          }}
          aria-hidden
        >
          {uploading
            ? <span className="text-white text-xs font-semibold">Saving…</span>
            : null}
        </div>
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 group-focus:opacity-100"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          aria-hidden
        >
          <span className="text-white text-xs font-semibold">Change</span>
        </div>
      </button>

      <p className="subtitle text-xs text-center">
        Tap to take a photo or choose from your library
      </p>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      {/* Hidden file input — capture="user" enables front camera on mobile,
          ignored on desktop where it opens the normal file picker */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={handleFile}
        aria-hidden
      />
    </div>
  )
}
