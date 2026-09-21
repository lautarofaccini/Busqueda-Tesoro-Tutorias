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
  return <div className="fixed inset-0 z-[70] flex items-end bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Escanear QR">
    <div className="mx-auto w-full max-w-sm rounded-xl bg-white p-5">
      <h2 className="text-xl font-black">Escanear QR</h2>
      {supported && <video ref={videoRef} muted playsInline className="mt-4 aspect-square w-full rounded bg-black object-cover" />}
      <p className="mt-3 text-sm">{message}</p>
      <div className="mt-4 flex flex-col gap-2"><button type="button" className="rounded border p-3 font-bold" onClick={onUseCode}>Ingresar código impreso</button><button type="button" className="rounded border p-3 font-bold" onClick={onClose}>Cerrar cámara</button></div>
    </div>
  </div>
}
