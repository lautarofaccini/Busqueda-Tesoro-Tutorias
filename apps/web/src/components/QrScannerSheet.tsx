import { useEffect, useRef, useState } from 'react'
import type { GameState } from '@busqueda-tesoro/shared'
import { scanToken } from '../api/client'

type DetectorResult = { rawValue: string }
type Detector = { detect(source: HTMLVideoElement): Promise<DetectorResult[]> }
type DetectorConstructor = new (options: { formats: string[] }) => Detector

function tokenFromQr(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    const match = url.pathname.match(/^\/q\/([^/]+)$/)
    return match ? decodeURIComponent(match[1]!) : null
  } catch { return null }
}

export function QrScannerSheet({ open, onClose, onScanned, onUseCode }: { open: boolean; onClose: () => void; onScanned: (state: GameState) => void; onUseCode: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const onScannedRef = useRef(onScanned)
  onScannedRef.current = onScanned
  const [message, setMessage] = useState('Preparando cámara…')
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSupported(true)
    setMessage('Preparando cámara…')
    const stop = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    const start = async () => {
      const DetectorClass = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
      if (!navigator.mediaDevices?.getUserMedia || !DetectorClass) {
        setSupported(false); setMessage('El escáner integrado no está disponible en este navegador. Usá la cámara del teléfono o el código impreso.'); return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) { stop(); return }
        video.srcObject = stream
        await video.play()
        setMessage('Apuntá la cámara al QR.')
        const detector = new DetectorClass({ formats: ['qr_code'] })
        const scan = async () => {
          if (cancelled || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            const token = codes[0] && tokenFromQr(codes[0].rawValue)
            if (token) {
              stop()
              const state = await scanToken(token)
              if (!cancelled) onScannedRef.current(state)
              return
            }
          } catch { /* Keep scanning transient video frames. */ }
          frameRef.current = requestAnimationFrame(() => void scan())
        }
        frameRef.current = requestAnimationFrame(() => void scan())
      } catch {
        setSupported(false); setMessage('No pudimos acceder a la cámara. Revisá el permiso o ingresá el código impreso.')
      }
    }
    void start()
    return () => { cancelled = true; stop() }
  }, [open])

  if (!open) return null
  return <div className="fixed inset-0 z-[70] flex items-end bg-amber-950/35 p-4 backdrop-blur-[1px] sm:items-center" role="dialog" aria-modal="true" aria-label="Escanear QR">
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-border-warm bg-surface-warm p-5 shadow-2xl">
      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden="true" /><h2 className="text-xl font-black text-foreground">Escanear QR</h2></div>
      {supported && <div className="mt-4 rounded-2xl border-4 border-brand/70 bg-amber-100 p-1 shadow-inner"><video ref={videoRef} muted playsInline className="aspect-square w-full rounded-xl bg-neutral-900 object-cover" /></div>}
      <p className="mt-3 text-sm font-medium text-muted" role="status">{message}</p>
      <div className="mt-4 flex flex-col gap-2">
        {!supported && <button type="button" className="rounded-lg bg-brand p-3 font-bold text-white hover:bg-brand-dark active:scale-[.99]" onClick={onUseCode}>No puedo escanear el QR</button>}
        <button type="button" className="rounded-lg border border-border-warm bg-white p-3 font-bold text-foreground hover:bg-amber-50 active:scale-[.99]" onClick={onClose}>Volver</button>
      </div>
    </div>
  </div>
}
