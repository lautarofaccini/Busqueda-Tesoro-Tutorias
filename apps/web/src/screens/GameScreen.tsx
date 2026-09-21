import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { GameState } from '@busqueda-tesoro/shared'
import { getGameState, getSupportStatus, revealSecondaryHint, submitFallbackCode, submitSupport } from '../api/client'
import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
import { EventPausedEndedView } from '../components/EventPausedEndedView'
import { ChallengeScreen } from './CheckpointScan'
import { ScoreDisplay } from '../components/ScoreDisplay'
import { GameplayRulesButton } from '../components/GameplayRulesButton'
import { QrScannerSheet } from '../components/QrScannerSheet'

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
  const [fallbackOpen, setFallbackOpen] = useState(false)
  const [helpSubmitting, setHelpSubmitting] = useState(false)
  const [confirmDamagedQr, setConfirmDamagedQr] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')
  const pendingReviewIds = useRef(new Set<number>())
  const notifiedReviewIds = useRef(new Set<number>())
  const pendingSupportIds = useRef(new Set<number>())

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

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const pollReviews = async () => {
      try {
        const status = await getSupportStatus()
        if (stopped) return
        for (const review of status.reviews) {
          if (review.status === 'PENDING') pendingReviewIds.current.add(review.id)
          if (review.status !== 'PENDING' && pendingReviewIds.current.has(review.id) && !notifiedReviewIds.current.has(review.id)) {
            notifiedReviewIds.current.add(review.id)
            setReviewMessage(review.status === 'APPROVED'
              ? `¡Tu respuesta fue aprobada! Puntaje corregido: +${review.scoreCorrection}`
              : 'Tu respuesta fue revisada y no fue aceptada.')
            const current = await getGameState()
            if (!stopped && current.state === 'COMPLETED') void navigate('/finish', { replace: true })
            else if (!stopped) setGameState(current)
          }
        }
        for (const request of status.support) {
          if (request.status === 'PENDING') pendingSupportIds.current.add(request.id)
          if (request.status === 'RESOLVED' && pendingSupportIds.current.has(request.id)) {
            pendingSupportIds.current.delete(request.id)
            setReviewMessage('Tutorías marcó tu pedido de ayuda como atendido.')
          }
        }
      } catch {
        // A transient polling failure must not interrupt gameplay.
      } finally {
        if (!stopped) timer = setTimeout(pollReviews, 12_000)
      }
    }
    void pollReviews()
    return () => { stopped = true; if (timer) clearTimeout(timer) }
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
      else if (next.state === 'ADVANCED') {
        setGameState(next)
        void navigate('/game', { replace: true, state: { scoreFeedback: '+100 puntos' } })
      }
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
      <BrandHeader rightElement={<GameplayRulesButton />} />
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
            <span className="text-xs font-mono font-semibold text-muted">
              <ScoreDisplay score={state.score} />
            </span>
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
          {reviewMessage && <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900" role="status">{reviewMessage}<button type="button" className="ml-3 underline" onClick={() => setReviewMessage('')}>Cerrar</button></div>}

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
                <span>Buscá ese lugar y escaneá el QR que encuentres allí.</span>
              </div>
              <button type="button" onClick={() => setScannerOpen(true)} className="mx-auto mt-5 flex flex-col items-center text-center" aria-label="Escanear QR">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/60 bg-amber-100/70 text-xs font-mono font-black text-amber-900">QR</span>
                <span className="mt-2 max-w-[240px] text-xs font-medium leading-relaxed text-muted">Al llegar al punto físico, escaneá el código para continuar.</span>
              </button>
            </div>
          ) : (
            <div className="border border-border-warm bg-surface-warm rounded-xl p-5 border-l-4 border-l-amber shadow-xs">
              <p className="text-sm text-muted">
                Escaneá el QR del próximo punto para ver el desafío.
              </p>
            </div>
          )}
          {clue && <div className="mt-4 space-y-3">
            <button onClick={() => { setFallbackCode(''); setHelpMessage(''); setFallbackOpen(true) }} className="w-full py-2 border border-brand text-brand hover:bg-brand hover:text-white font-bold rounded text-sm transition-colors">
              No puedo escanear el QR
            </button>
            <button className="w-full text-sm font-bold text-brand underline" onClick={() => setHelpOpen(true)}>¿Necesitás ayuda?</button>
          </div>}
        </div>
        <QrScannerSheet open={scannerOpen} onClose={() => setScannerOpen(false)} onUseCode={() => { setScannerOpen(false); setFallbackCode(''); setHelpMessage(''); setFallbackOpen(true) }} onScanned={next => { setScannerOpen(false); if (next.state === 'COMPLETED') void navigate('/finish', { replace: true }); else setGameState(next) }} />
        {fallbackOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center bg-black/60 p-4">
            <div className="w-full max-w-sm mx-auto rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-2">¿No podés escanear el QR?</h2>
              <p className="text-sm text-muted mb-4">Escribí el código que aparece debajo del QR.</p>
              <div className="flex flex-col gap-3">
                <input
                  className="rounded border p-3 uppercase text-lg text-center tracking-widest outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  value={fallbackCode}
                  onChange={e => setFallbackCode(e.target.value)}
                  placeholder="Ej: AB12"
                  autoFocus
                />
                {helpMessage && <p className="text-sm text-red-600 font-bold text-center">{helpMessage}</p>}
                <div className="flex gap-3 mt-2">
                  <button className="flex-1 rounded border p-3 font-bold" onClick={() => setFallbackOpen(false)}>Cancelar</button>
                  <button className="flex-1 rounded bg-brand p-3 font-bold text-white" onClick={async () => {
                    if (!fallbackCode.trim()) return
                    setHelpMessage('')
                    try {
                      const next = await submitFallbackCode(fallbackCode)
                      if (next.state === 'WRONG_CHECKPOINT') {
                        setHelpMessage('Este código no corresponde a tu próximo punto.')
                      } else if (next.state === 'NEEDS_START') {
                        setHelpMessage('Código inválido.')
                      } else {
                        setGameState(next)
                        setFallbackOpen(false)
                      }
                    } catch {
                      setHelpMessage('No se pudo validar el código.')
                    }
                  }}>Continuar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {helpOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4"><div className="w-full rounded-xl bg-white p-5"><h2 className="font-bold">¿Necesitás ayuda?</h2><div className="mt-3 flex flex-col gap-2"><button disabled={helpSubmitting} className="rounded border p-3 text-left disabled:opacity-50" onClick={() => { setHelpOpen(false); setHelpMessage(''); setFallbackCode(''); setFallbackOpen(true) }}>No puedo escanear el QR</button><button disabled={helpSubmitting} className="rounded border p-3 text-left disabled:opacity-50" onClick={() => { setHelpMessage(''); setConfirmDamagedQr(true) }}>El QR está dañado, fue quitado o no funciona</button><button disabled={helpSubmitting} className="rounded border p-3 text-left disabled:opacity-50" onClick={() => setHelpMessage('Podés pedir la revisión desde la pantalla del desafío, después de una respuesta incorrecta.')}>Mi respuesta debería ser correcta</button><button disabled={helpSubmitting} className="rounded border p-3 text-left disabled:opacity-50" onClick={async () => { setHelpSubmitting(true); setHelpMessage(''); try { const result = await submitSupport('OTHER'); if (result.id) pendingSupportIds.current.add(result.id); setHelpMessage(result.message ?? 'Avisamos al equipo de asistencia.') } catch { setHelpMessage('No se pudo enviar el aviso. Intentá nuevamente.') } finally { setHelpSubmitting(false) } }}>Otro problema</button></div>{confirmDamagedQr && <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm"><p>Esto avisará a Tutorías que el QR está dañado, fue quitado o no funciona.</p><div className="mt-3 flex gap-2"><button disabled={helpSubmitting} className="rounded bg-brand px-3 py-2 font-bold text-white disabled:opacity-50" onClick={async () => { setHelpSubmitting(true); setHelpMessage(''); try { const result = await submitSupport('QR_DAMAGED'); if (result.id) pendingSupportIds.current.add(result.id); setHelpMessage(result.message ?? 'Avisamos a Tutorías.'); setConfirmDamagedQr(false) } catch { setHelpMessage('No se pudo enviar el aviso. Intentá nuevamente.') } finally { setHelpSubmitting(false) } }}>{helpSubmitting ? 'Enviando…' : 'Enviar aviso'}</button><button disabled={helpSubmitting} className="rounded border px-3 py-2 font-bold disabled:opacity-50" onClick={() => setConfirmDamagedQr(false)}>Cancelar</button></div></div>}{helpMessage && <p className="mt-3 text-sm text-brand font-bold" role="status">{helpMessage}</p>}<button disabled={helpSubmitting} className="mt-4 w-full rounded border p-2 font-bold disabled:opacity-50" onClick={() => { setHelpOpen(false); setConfirmDamagedQr(false); setHelpMessage('') }}>Cerrar</button></div></div>}

        {/* Footer */}
        <footer className="pt-4 border-t border-border/70 flex items-center justify-between text-xs text-muted">
          <span className="font-bold tracking-wider uppercase text-[10px]">Tutorías · UTN FRRe</span>
          <span className="font-mono text-[10px] text-muted/70 truncate max-w-[140px]">{playerName}</span>
        </footer>
      </main>
    </MobileShell>
  )
}
