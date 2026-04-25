'use client'
import { useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let controls: IScannerControls | null = null

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromVideoElement(
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
    return () => {
      controls?.stop()
    }
  }, [onDetected])

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
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-1 bg-green-400 opacity-80" />
          </div>
        </div>
      )}
      <p className="text-white/60 text-sm text-center p-4">Point at the barcode on the back of the item</p>
    </div>
  )
}
