import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StateCompleted } from '@busqueda-tesoro/shared'
import { getGameState } from '../api/client'
import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'

/**
 * FinishScreen — shown at /finish when a session is COMPLETED.
 *
 * Recovers completion data from GET /api/game/state.
 * No leaderboard yet.
 */
export function FinishScreen() {
  const navigate = useNavigate()
  const [state, setState] = useState<StateCompleted | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getGameState()
      .then((s) => {
        if (s.state === 'COMPLETED') {
          setState(s)
        } else if (s.state === 'NEEDS_START') {
          void navigate('/', { replace: true })
        } else {
          void navigate('/game', { replace: true })
        }
        setLoading(false)
      })
      .catch(() => {
        void navigate('/', { replace: true })
      })
  }, [navigate])

  if (loading) {
    return (
      <MobileShell>
        <BrandHeader />
        <main className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin mb-4" />
          <p className="text-sm text-muted font-medium">Cargando…</p>
        </main>
      </MobileShell>
    )
  }

  if (!state) return null

  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 flex flex-col justify-between px-6 pt-7 pb-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-xs bg-brand" aria-hidden="true" />
            <span className="text-xs font-bold tracking-widest text-brand uppercase">
              Recorrido completado
            </span>
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight leading-tight">
            ¡Terminaste!
          </h1>
          <div className="flex items-center gap-1.5 mt-3 mb-6" aria-hidden="true">
            <div className="h-1 w-12 bg-brand rounded-full" />
            <div className="h-1 w-4 bg-yellow rounded-full" />
          </div>

          <div className="border-l-4 border-l-brand bg-surface border border-border rounded-r-lg p-5 shadow-xs">
            <p className="text-lg font-black text-brand">Puntaje final: {state.score}</p>
            <p className="mt-3 text-sm text-muted">Tu resultado quedó guardado.<br />Tutorías publicará a los ganadores.</p>
            <p className="mt-3 text-sm text-muted">Si hay empate en puestos con premio, se definirá con una trivia.</p>
          </div>
        </div>

        {/* Motif */}
        <div className="my-auto py-8 flex flex-col items-center justify-center text-center" aria-hidden="true">
          <div className="w-16 h-16 rounded-full bg-brand/10 border-2 border-brand/30 flex items-center justify-center mb-3">
            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
              <span className="text-white text-sm font-black">✓</span>
            </div>
          </div>
          <p className="text-xs font-mono font-bold tracking-widest text-brand uppercase">Misión cumplida</p>
        </div>

        {/* Footer */}
        <footer className="pt-4 border-t border-border/70 flex items-center justify-between text-xs text-muted">
          <span className="font-bold tracking-wider uppercase text-[10px]">Tutorías · UTN FRRe</span>
          <span className="font-mono text-[10px] text-muted/70">Resistencia, Chaco</span>
        </footer>
      </main>
    </MobileShell>
  )
}
