import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameState } from '@busqueda-tesoro/shared'
import { getGameState } from '../api/client'
import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
import { EventPausedEndedView } from '../components/EventPausedEndedView'

/**
 * GameScreen — shown at /game.
 *
 * Recovers session state on mount via GET /api/game/state.
 * Shows the current clue and step counter from backend state.
 *
 * Refresh-safe: cookie + game/state endpoint restores the screen.
 */
export function GameScreen() {
  const navigate = useNavigate()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getGameState()
      .then((state) => {
        if (state.state === 'NEEDS_START') {
          void navigate('/', { replace: true })
        } else if (state.state === 'COMPLETED') {
          void navigate('/finish', { replace: true })
        } else {
          setGameState(state)
          setLoading(false)
        }
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
          <p className="text-sm text-muted font-medium">Cargando misión…</p>
        </main>
      </MobileShell>
    )
  }

  const state = gameState
  if (!state) return null

  if (state.state === 'EVENT_PAUSED' || state.state === 'EVENT_ENDED') {
    return <EventPausedEndedView state={state.state} />
  }

  if (state.state !== 'ACTIVE' && state.state !== 'ADVANCED' && state.state !== 'CHALLENGE' && state.state !== 'ANSWER_INCORRECT') {
    return null
  }

  const clue = 'clue' in state ? state.clue : null
  const stepNumber = state.stepNumber
  const totalSteps = state.totalSteps
  const playerName = state.playerName

  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 flex flex-col justify-between px-6 pt-6 pb-8">
        {/* Status */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-100/90 border border-amber-300/80">
              <span className="w-2 h-2 rounded-xs bg-brand" aria-hidden="true" />
              <span className="text-xs font-mono font-bold tracking-wider text-amber-950 uppercase">
                MISIÓN {stepNumber} DE {totalSteps}
              </span>
            </div>
            <span className="text-xs font-mono font-semibold text-muted">EN CURSO</span>
          </div>

          <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight">
            Tu próxima pista
          </h1>
          <div className="flex items-center gap-1.5 mt-2.5 mb-5" aria-hidden="true">
            <div className="h-1 w-12 bg-brand rounded-full" />
            <div className="h-1 w-4 bg-yellow rounded-full" />
          </div>

          {/* Clue card */}
          {clue ? (
            <div className="border border-border-warm bg-surface-warm rounded-xl p-5 border-l-4 border-l-brand shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand bg-brand/10 px-2 py-0.5 rounded">
                  PISTA ACTIVA
                </span>
              </div>
              <p className="text-base text-foreground font-medium leading-relaxed">
                {clue}
              </p>
              <div className="mt-4 pt-3 border-t border-dashed border-border/80 flex items-center gap-2 text-xs text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-amber" aria-hidden="true" />
                <span>Buscá el código QR en la ubicación descrita</span>
              </div>
            </div>
          ) : (
            <div className="border border-border-warm bg-surface-warm rounded-xl p-5 border-l-4 border-l-amber shadow-xs">
              <p className="text-sm text-muted">
                Escaneá el QR del próximo punto para ver el desafío.
              </p>
            </div>
          )}
        </div>

        {/* Player tag */}
        <div className="my-auto py-5 flex flex-col items-center justify-center text-center" aria-hidden="true">
          <div className="w-11 h-11 rounded-full bg-amber-100/70 border border-amber-300/60 flex items-center justify-center mb-2">
            <span className="text-xs font-mono font-black text-amber-900">QR</span>
          </div>
          <p className="text-xs text-muted font-medium max-w-[240px] leading-relaxed">
            Al llegar al punto físico, escaneá el código para continuar.
          </p>
        </div>

        {/* Footer */}
        <footer className="pt-4 border-t border-border/70 flex items-center justify-between text-xs text-muted">
          <span className="font-bold tracking-wider uppercase text-[10px]">Tutorías · UTN FRRe</span>
          <span className="font-mono text-[10px] text-muted/70 truncate max-w-[140px]">{playerName}</span>
        </footer>
      </main>
    </MobileShell>
  )
}
