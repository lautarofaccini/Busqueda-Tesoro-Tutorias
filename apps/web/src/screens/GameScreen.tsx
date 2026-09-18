import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { GameState } from '@busqueda-tesoro/shared'
import { getGameState, revealSecondaryHint, submitFallbackCode, submitSupport } from '../api/client'
import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
import { EventPausedEndedView } from '../components/EventPausedEndedView'
import { ChallengeScreen } from './CheckpointScan'

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
  const location = useLocation()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingHint, setLoadingHint] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [fallbackCode, setFallbackCode] = useState('')
  const [helpMessage, setHelpMessage] = useState('')

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

  if (state.state === 'CHALLENGE' || state.state === 'ANSWER_INCORRECT') {
    return <ChallengeScreen state={state} onResult={(next) => {
      if (next.state === 'COMPLETED') void navigate('/finish', { replace: true })
      else if (next.state === 'ADVANCED') void navigate('/game', { replace: true, state: { scoreFeedback: '+100 puntos' } })
      else setGameState(next)
    }} />
  }

  if (state.state !== 'ACTIVE' && state.state !== 'ADVANCED') {
    return null
  }


  const clue = 'clue' in state ? state.clue : null
  const secondaryClue = 'secondaryClue' in state ? state.secondaryClue : null
  const hasSecondaryClue = 'hasSecondaryClue' in state ? state.hasSecondaryClue : false
  const instruction = 'instruction' in state ? state.instruction : null
  const handleRevealHint = async () => {
    setLoadingHint(true)
    try {
      const newState = await revealSecondaryHint()
      setGameState(newState)
    } finally {
      setLoadingHint(false)
    }
  }

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
            <span className="text-xs font-mono font-semibold text-muted">Puntos: {state.score}</span>
          </div>

          <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight">
            {state.state === 'ADVANCED' ? '¡Correcto! +100 puntos' : 'Tu próximo destino'}
          </h1>
          <p className="mt-1 text-xs text-muted">Correcta +100 · Incorrecta -10 · Pista -5</p>
          <div className="flex items-center gap-1.5 mt-2.5 mb-5" aria-hidden="true">
            <div className="h-1 w-12 bg-brand rounded-full" />
            <div className="h-1 w-4 bg-yellow rounded-full" />
          </div>
          {(state.state === 'ADVANCED' || (location.state as { scoreFeedback?: string } | null)?.scoreFeedback) && <p className="mb-4 rounded bg-green-50 p-3 text-sm font-bold text-green-800" role="status">{(location.state as { scoreFeedback?: string } | null)?.scoreFeedback ?? '+100 puntos'}</p>}

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
              {instruction && (
                <div className="mt-4 p-3 bg-neutral-100 rounded text-sm text-neutral-700 border-l-4 border-l-neutral-400">
                  <span className="block font-bold text-xs uppercase mb-1">Nota:</span>
                  {instruction}
                </div>
              )}

              {secondaryClue && (
                <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-900 border-l-4 border-l-blue-400">
                  <span className="block font-bold text-xs uppercase mb-1">Pista adicional:</span>
                  {secondaryClue}
                </div>
              )}

              {hasSecondaryClue && (
                <div className="mt-4">
                  <button
                    onClick={handleRevealHint}
                    disabled={loadingHint}
                    className="w-full py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold rounded text-sm disabled:opacity-50"
                  >
                    {loadingHint ? 'Revelando...' : 'Ver pista adicional'}
                  </button>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-dashed border-border/80 flex items-center gap-2 text-xs text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-amber" aria-hidden="true" />
                <span>Buscá ese lugar y escaneá el QR para desbloquear el siguiente desafío.</span>
              </div>
              <button className="mt-4 text-sm font-bold text-brand underline" onClick={() => setHelpOpen(true)}>¿Necesitás ayuda?</button>
            </div>
          ) : (
            <div className="border border-border-warm bg-surface-warm rounded-xl p-5 border-l-4 border-l-amber shadow-xs">
              <p className="text-sm text-muted">
                Escaneá el QR del próximo punto para ver el desafío.
              </p>
            </div>
          )}
        </div>

        {helpOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4"><div className="w-full rounded-xl bg-white p-5"><h2 className="font-bold">¿Necesitás ayuda?</h2><div className="mt-3 flex flex-col gap-2"><button className="rounded border p-3 text-left" onClick={() => { setHelpMessage('Si tu respuesta fue rechazada, podés pedir revisión desde la pantalla del desafío.') }}>Mi respuesta debería ser correcta</button><button className="rounded border p-3 text-left" onClick={async () => { await submitSupport('QR_SCAN'); setHelpMessage('Avisamos al equipo de asistencia.') }}>No puedo escanear el QR</button><button className="rounded border p-3 text-left" onClick={async () => { await submitSupport('QR_DAMAGED'); setHelpMessage('Avisamos al equipo de asistencia.') }}>El QR está dañado o no funciona</button><button className="rounded border p-3 text-left" onClick={async () => { await submitSupport('OTHER'); setHelpMessage('Avisamos al equipo de asistencia.') }}>Otro problema</button></div><div className="mt-4 border-t pt-3"><label className="text-sm font-bold">Ingresar código del checkpoint</label><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded border p-2 uppercase" value={fallbackCode} onChange={e => setFallbackCode(e.target.value)} /><button className="rounded bg-brand px-3 text-white" onClick={async () => { try { const next = await submitFallbackCode(fallbackCode); setGameState(next); setHelpOpen(false) } catch { setHelpMessage('No se pudo validar el código.') } }}>Validar</button></div></div>{helpMessage && <p className="mt-3 text-sm">{helpMessage}</p>}<button className="mt-4 w-full rounded border p-2" onClick={() => setHelpOpen(false)}>Cerrar</button></div></div>}

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
