import { useEffect, useState } from 'react'
import type { ClosingGraceInfo } from '@busqueda-tesoro/shared'

function formatRemaining(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function ClosingGraceNotice({ closing }: { closing: ClosingGraceInfo | undefined }) {
  const [remaining, setRemaining] = useState(closing?.remainingSeconds ?? 0)

  useEffect(() => {
    setRemaining(closing?.remainingSeconds ?? 0)
  }, [closing?.deadline, closing?.remainingSeconds])

  useEffect(() => {
    if (!closing || remaining <= 0) return
    const timer = window.setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1_000)
    return () => window.clearTimeout(timer)
  }, [closing, remaining])

  if (!closing) return null

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
      <p className="font-black">Inscripciones cerradas</p>
      <p className="mt-1 font-medium">
        {remaining > 0
          ? `Tenés ${formatRemaining(remaining)} para terminar tu recorrido.`
          : 'El tiempo para finalizar terminó.'}
      </p>
    </div>
  )
}
