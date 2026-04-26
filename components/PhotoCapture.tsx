'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: (file: File) => void
  onClose: () => void
}

export default function PhotoCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        setError('Camera access denied. Please allow camera access in your browser settings.')
      }
    }
    start()
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  function capture() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' })
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCapture(file)
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex justify-between items-center p-4">
        <span className="text-white font-semibold">Take cover photo</span>
        <button onClick={onClose} className="text-white text-2xl">✕</button>
      </div>
      {error ? (
        <p className="text-red-400 text-center p-8">{error}</p>
      ) : (
        <div className="flex-1 relative">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </div>
      )}
      {!error && (
        <div className="flex justify-center p-6">
          <button
            onClick={capture}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 active:bg-white/40"
            aria-label="Take photo"
          />
        </div>
      )}
    </div>
  )
}
