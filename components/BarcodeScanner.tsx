'use client'
import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [useFileInput] = useState(() => isIOS())

  async function handleFileCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const url = URL.createObjectURL(file)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      const result = await reader.decodeFromImageUrl(url)
      URL.revokeObjectURL(url)
      onDetected(result.getText())
    } catch {
      URL.revokeObjectURL(url)
      setError('No barcode found. Try again in better light or closer to the barcode.')
      // Reset input so user can try again
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (useFileInput) return
    let controls: IScannerControls | null = null

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current!,
          (result) => {
            if (result) {
              controls?.stop()
              onDetected(result.getText())
            }
          }
        )
      } catch {
        setError('Camera access denied. Please allow camera access and try again.')
      }
    }

    start()
    return () => { controls?.stop() }
  }, [onDetected, useFileInput])

  if (useFileInput) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-6 p-8">
        <span className="text-white font-semibold text-lg">Scan barcode</span>
        <p className="text-white/60 text-sm text-center">Take a photo of the barcode on the back of the item</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileCapture}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary px-8 py-3 text-base"
        >
          Open Camera
        </button>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button onClick={onClose} className="text-white/60 text-sm mt-2">Cancel</button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex justify-between items-center p-4">
        <span className="text-white font-semibold">Scan barcode</span>
        <button onClick={onClose} className="text-white text-2xl">✕</button>
      </div>
      {error ? (
        <p className="text-red-400 text-center p-8">{error}</p>
      ) : (
        <div className="relative flex-1">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-1 bg-green-400 opacity-80" />
          </div>
        </div>
      )}
      <p className="text-white/60 text-sm text-center p-4">Point at the barcode on the back of the item</p>
    </div>
  )
}
