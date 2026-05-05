'use client'
import { useState } from 'react'

interface ImportResult {
  imported: number
  skipped: { title: string; reason: string }[]
}

export default function BolImport() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleImport() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/import/bol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareUrl: url }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Import failed')
      } else {
        setResult(data)
        setUrl('')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card p-5 flex flex-col gap-3">
      <h2 className="font-serif text-lg font-semibold">Import from Bol.com</h2>
      <p className="subtitle text-sm">
        Paste a shared Bol.com wishlist link to import items into your wishlist.
      </p>
      <input
        className="input text-sm"
        placeholder="https://www.bol.com/nl/nl/verlanglijstje/…"
        value={url}
        onChange={e => setUrl(e.target.value)}
        disabled={loading}
      />
      <button
        onClick={handleImport}
        disabled={loading || !url.trim()}
        className="btn-primary"
      >
        {loading ? 'Importing…' : 'Import wishlist'}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {result && (
        <div className="text-sm flex flex-col gap-1">
          <p className="font-medium" style={{ color: result.imported > 0 ? 'var(--accent)' : undefined }}>
            {result.imported === 0
              ? 'No new items found.'
              : `${result.imported} item${result.imported !== 1 ? 's' : ''} added to your wishlist.`}
          </p>
          {result.skipped.length > 0 && (
            <details>
              <summary className="subtitle cursor-pointer text-xs">
                {result.skipped.length} skipped
              </summary>
              <ul className="mt-1 flex flex-col gap-0.5 pl-2">
                {result.skipped.map((s, i) => (
                  <li key={i} className="subtitle text-xs">
                    {s.title} — {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
