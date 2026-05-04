'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PasswordField from '@/components/PasswordField'
import AppVersion from '@/components/AppVersion'
import type { Member } from '@/lib/types'

const BACKFILL_TYPES = [
  { value: 'vinyl', label: 'Vinyl', hint: 'sort name, tracklist, genre, style, cover (Discogs)' },
  { value: 'book', label: 'Books', hint: 'description, ISBN, cover (OL · Google Books · KB)' },
  { value: 'comic', label: 'Comics', hint: 'description, cover (ComicVine)' },
  { value: 'lego', label: 'Lego', hint: 'theme, part count, year, cover (Rebrickable)' },
]

type CollectionStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled'

interface CollectionResult {
  status: CollectionStatus
  total?: number
  updated?: number
  error?: string
}

function BackfillButton() {
  const [running, setRunning] = useState(false)
  const [force, setForce] = useState(false)
  const [forceCovers, setForceCovers] = useState(false)
  const [types, setTypes] = useState<string[]>(['vinyl', 'book', 'comic', 'lego'])
  const [progress, setProgress] = useState<Record<string, CollectionResult>>({})
  const abortRef = useRef<AbortController | null>(null)

  function toggleType(value: string) {
    setTypes(prev => prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value])
  }

  function cancel() {
    abortRef.current?.abort()
  }

  async function run() {
    if (!types.length) return
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setProgress(Object.fromEntries(types.map(t => [t, { status: 'pending' as CollectionStatus }])))

    for (const type of types) {
      if (controller.signal.aborted) {
        setProgress(prev => ({ ...prev, [type]: { status: 'cancelled' } }))
        continue
      }
      setProgress(prev => ({ ...prev, [type]: { status: 'running' } }))
      try {
        const params = new URLSearchParams({ types: type })
        if (force) params.set('force', 'true')
        if (forceCovers) params.set('force_covers', 'true')
        const res = await fetch(`/api/admin/backfill-sort?${params}`, { signal: controller.signal })
        const data = await res.json()
        if (res.ok) {
          const s = (data.summary as Record<string, { total: number; updated: number }>)[type]
          setProgress(prev => ({ ...prev, [type]: { status: 'done', total: s?.total ?? 0, updated: s?.updated ?? 0 } }))
        } else {
          setProgress(prev => ({ ...prev, [type]: { status: 'error', error: data.error ?? 'Failed' } }))
        }
      } catch {
        if (controller.signal.aborted) {
          setProgress(prev => ({ ...prev, [type]: { status: 'cancelled' } }))
        } else {
          setProgress(prev => ({ ...prev, [type]: { status: 'error', error: 'Request failed' } }))
        }
        break
      }
    }

    setRunning(false)
    abortRef.current = null
  }

  const statusIcon: Record<CollectionStatus, string> = {
    pending: '·',
    running: '⟳',
    done: '✓',
    error: '✗',
    cancelled: '—',
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {BACKFILL_TYPES.map(t => (
          <label key={t.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={types.includes(t.value)} onChange={() => toggleType(t.value)} disabled={running} />
            <span>{t.label}</span>
            <span className="opacity-50 text-xs">({t.hint})</span>
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} disabled={running} />
        Force re-fetch (even if already filled)
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={forceCovers} onChange={e => setForceCovers(e.target.checked)} disabled={running} />
        Re-download covers at higher resolution (skips custom photos)
      </label>
      <div className="flex gap-2 items-center">
        <button onClick={run} disabled={running || !types.length} className="btn-ghost text-sm self-start">
          Run backfill
        </button>
        {running && (
          <button onClick={cancel} className="btn-ghost text-sm self-start" style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
        )}
      </div>
      {Object.keys(progress).length > 0 && (
        <div className="flex flex-col gap-1">
          {types.filter(t => progress[t]).map(type => {
            const s = progress[type]
            const label = BACKFILL_TYPES.find(t => t.value === type)?.label ?? type
            return (
              <div key={type} className="flex items-center gap-2 text-sm">
                <span
                  className="w-4 text-center font-mono"
                  style={{
                    color: s.status === 'done' ? 'var(--accent)' : s.status === 'error' ? '#ef4444' : 'var(--text-muted)',
                    animation: s.status === 'running' ? 'spin 1s linear infinite' : undefined,
                  }}
                >
                  {statusIcon[s.status]}
                </span>
                <span style={{ color: s.status === 'pending' || s.status === 'cancelled' ? 'var(--text-muted)' : 'inherit' }}>
                  {label}
                </span>
                {s.status === 'done' && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {s.updated}/{s.total} updated
                  </span>
                )}
                {s.status === 'error' && (
                  <span className="text-xs text-red-500">{s.error}</span>
                )}
                {s.status === 'running' && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>running…</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BackupSection() {
  const [exportStatus, setExportStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [importStatus, setImportStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [importResult, setImportResult] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    setExportStatus('running')
    try {
      const res = await fetch('/api/admin/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `collection-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportStatus('done')
    } catch {
      setExportStatus('error')
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('running')
    setImportResult('')
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      const data = await res.json()
      if (res.ok) {
        setImportResult(`Imported ${data.imported} items, skipped ${data.skipped} duplicates.`)
        setImportStatus('done')
      } else {
        setImportResult(data.error ?? 'Import failed')
        setImportStatus('error')
      }
    } catch {
      setImportResult('Could not read or parse the file.')
      setImportStatus('error')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="subtitle text-sm">
          Downloads a JSON file with all items, members, and cover images embedded.
          Store it somewhere safe (Google Drive, iCloud, etc.).
        </p>
        <button
          onClick={handleExport}
          disabled={exportStatus === 'running'}
          className="btn-ghost text-sm self-start"
        >
          {exportStatus === 'running' ? 'Preparing download…' : 'Download backup'}
        </button>
        {exportStatus === 'done' && <p className="text-green-600 text-sm">Download started.</p>}
        {exportStatus === 'error' && <p className="text-red-500 text-sm">Export failed — try again.</p>}
      </div>

      <div className="flex flex-col gap-2">
        <p className="subtitle text-sm">
          Restore from a backup file. Existing items are skipped (no duplicates).
          Cover images are re-uploaded automatically.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImport}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importStatus === 'running'}
          className="btn-ghost text-sm self-start"
        >
          {importStatus === 'running' ? 'Importing…' : 'Restore from backup'}
        </button>
        {importResult && (
          <p className={`text-sm ${importStatus === 'error' ? 'text-red-500' : 'text-green-600'}`}>
            {importResult}
          </p>
        )}
      </div>
    </div>
  )
}

function MemberPinsSection() {
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersError, setMembersError] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successes, setSuccesses] = useState<Record<string, boolean>>({})

  const loadMembers = useCallback(() => {
    setMembersLoading(true)
    setMembersError(false)
    fetch('/api/members')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setMembers(data); setMembersLoading(false) })
      .catch(() => { setMembersError(true); setMembersLoading(false) })
  }, [])

  useEffect(() => { loadMembers() }, [loadMembers])

  async function updateMemberPin(memberId: string, newValue: string) {
    setErrors(prev => ({ ...prev, [memberId]: '' }))
    setSuccesses(prev => ({ ...prev, [memberId]: false }))
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'member_pin', memberId, newValue }),
    })
    if (res.ok) {
      setSuccesses(prev => ({ ...prev, [memberId]: true }))
    } else {
      const { error } = await res.json()
      setErrors(prev => ({ ...prev, [memberId]: error ?? 'Something went wrong' }))
    }
  }

  if (membersLoading) return <p className="subtitle text-sm">Loading members…</p>
  if (membersError) return (
    <div className="flex flex-col gap-2">
      <p className="subtitle text-sm">Could not load members.</p>
      <button onClick={loadMembers} className="btn-ghost text-xs self-start">Retry</button>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {members.map(m => (
        <div key={m.id} className="flex flex-col gap-2">
          <p className="font-semibold">{m.name}</p>
          <PasswordField
            placeholder="Set PIN (min 4 characters)"
            buttonLabel="Set PIN"
            error={errors[m.id]}
            onSubmit={v => updateMemberPin(m.id, v)}
          />
          {successes[m.id] && <p className="text-green-600 text-sm">PIN set for {m.name}.</p>}
        </div>
      ))}
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
        <h2 className="font-serif text-lg font-semibold">Member PINs</h2>
        <p className="subtitle text-sm">Each family member can log in with their own PIN to edit only their own collection.</p>
        <MemberPinsSection />
      </section>

      <section className="card p-6 flex flex-col gap-4">
        <h2 className="font-serif text-lg font-semibold">Data Backfill</h2>
        <p className="subtitle text-sm">Fetches missing data from external APIs for each collection type. Only fills gaps unless Force is enabled. Takes ~1–2 seconds per item.</p>
        <BackfillButton />
      </section>

      <section className="card p-6 flex flex-col gap-4">
        <h2 className="font-serif text-lg font-semibold">Backup & Restore</h2>
        <BackupSection />
      </section>

      <AppVersion />
    </main>
  )
}
