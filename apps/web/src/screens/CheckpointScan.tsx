import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState, SessionStartRequest } from '@busqueda-tesoro/shared'
import { ApiError, scanToken, startSession, submitAnswer, revealQuestionHint, submitAnswerReview, submitSupport, getSupportStatus, getGameState } from '../api/client'
import type { PlayerReviewStatus } from '../api/client'
import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
import { Button } from '../components/Button'
import { ScoreDisplay } from '../components/ScoreDisplay'
import { EventPausedEndedView } from '../components/EventPausedEndedView'
import { GameplayRulesButton } from '../components/GameplayRulesButton'
import { acknowledgeReview, isReviewAcknowledged } from '../lib/reviewAcknowledgement'

/**
 * CheckpointScan — production screen for /q/:token.
 *
 * This screen handles ALL QR token scan states in one place:
 *   NEEDS_START     → "este QR es parte de la búsqueda, buscá el inicio"
 *   START_ALLOWED   → name entry form (wired to real session/start)
 *   WRONG_CHECKPOINT→ "este no es tu próximo punto"
 *   CHALLENGE       → show challenge, accept answer
 *   ACTIVE          → redirect to /game
 *   COMPLETED       → redirect to /finish
 *
 * Security: no checkpoint name or future tokens are stored in local state.
 */
export function CheckpointScan() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [gameState, setGameState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Scan the token on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setError('Token inválido.')
      setLoading(false)
      return
    }
    void scanToken(token)
      .then((state) => {
        if (state.state === 'ACTIVE' || state.state === 'ADVANCED') {
          void navigate('/game', { replace: true })
        } else if (state.state === 'COMPLETED') {
          void navigate('/finish', { replace: true })
        } else {
          setGameState(state)
          setLoading(false)
        }
      })
      .catch(() => {
        setError('Error al verificar el código QR. Intentá de nuevo.')
        setLoading(false)
      })
  }, [token, navigate])

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <MobileShell>
        <BrandHeader />
        <main className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin mb-4" />
          <p className="text-sm text-muted font-medium">Verificando…</p>
        </main>
      </MobileShell>
    )
  }

  const state = gameState
  // ── Error ───────────────────────────────────────────────────────────────
  if (error || !state) {
    return (
      <MobileShell>
        <BrandHeader />
        <main className="flex-1 flex flex-col justify-center px-6 pt-7 pb-8">
          <div className="border-l-4 border-l-amber bg-surface-warm border border-border rounded-r-lg p-5 shadow-xs mt-6">
            <p className="text-base text-foreground font-semibold">{error ?? 'Error desconocido.'}</p>
          </div>
        </main>
      </MobileShell>
    )
  }

  if (state.state === 'EVENT_PAUSED' || state.state === 'EVENT_ENDED') {
    return <EventPausedEndedView state={state.state} />
  }

  // ── Route to sub-screens based on state ────────────────────────────────
  if (gameState.state === 'NEEDS_START') {
    return <NeedsStartScreen />
  }
  if (gameState.state === 'START_ALLOWED') {
    return <StartForm startToken={gameState.startToken} onStarted={setGameState} />
  }
  if (gameState.state === 'WRONG_CHECKPOINT') {
    return <WrongCheckpointScreen onBack={() => void navigate('/game')} />
  }
  if (gameState.state === 'CHALLENGE' || gameState.state === 'ANSWER_INCORRECT') {
    return (
      <ChallengeScreen
        state={gameState}
        onResult={(next) => {
          if (next.state === 'COMPLETED') {
            void navigate('/finish', { replace: true })
          } else if (next.state === 'ADVANCED' || next.state === 'ACTIVE') {
            void navigate('/game', { replace: true, state: { scoreFeedback: '+100 puntos' } })
          } else {
            setGameState(next)
          }
        }}
      />
    )
  }

  return <MobileShell><BrandHeader /><main className="flex flex-1 flex-col items-center justify-center px-6 text-center"><h1 className="text-xl font-black">No pudimos cargar el siguiente paso.</h1><p className="mt-2 text-sm text-muted">Tu avance está guardado.</p><Button className="mt-5" onClick={() => void navigate('/game', { replace: true })}>Reintentar</Button></main></MobileShell>
}

// ── Sub-screens ─────────────────────────────────────────────────────────

function NeedsStartScreen() {
  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 flex flex-col justify-between px-6 pt-7 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-xs bg-brand" aria-hidden="true" />
            <span className="text-xs font-bold tracking-widest text-brand uppercase">
              Búsqueda del tesoro
            </span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight">
            Este QR forma parte de la búsqueda.
          </h1>
          <div className="flex items-center gap-1.5 mt-3 mb-6" aria-hidden="true">
            <div className="h-1 w-12 bg-brand rounded-full" />
            <div className="h-1 w-4 bg-yellow rounded-full" />
          </div>
          <div className="border-l-4 border-l-brand bg-surface border border-border rounded-r-lg p-5 shadow-xs">
            <p className="text-base text-foreground font-semibold leading-relaxed">
              Para comenzar, buscá el QR de inicio en Tutorías.
            </p>
          </div>
        </div>
      </main>
    </MobileShell>
  )
}

interface StartFormProps {
  startToken: string
  onStarted: (state: GameState) => void
}



function StartForm({ startToken, onStarted }: StartFormProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<'rules' | 'form'>('rules')
  const [playerName, setPlayerName] = useState('')
  const [lastName, setLastName] = useState('')
  const [career, setCareer] = useState<'' | SessionStartRequest['career']>('')
  const [identifierType] = useState<'DNI'>('DNI')
  const [identifierValue, setIdentifierValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const expectedLength = 8
    if (!playerName.trim() || !lastName.trim() || !career.trim() || !identifierValue.trim()) {
      setErr('Completá todos los datos para comenzar.')
      return
    }
    if (!new RegExp(`^\\d{${expectedLength}}$`).test(identifierValue)) {
      setErr('El DNI debe tener exactamente 8 dígitos numéricos.')
      return
    }
    setSubmitting(true)
    setErr(null)
    try {
      const state = await startSession({ 
        playerName: playerName.trim(), 
        lastName: lastName.trim(),
        career: career as SessionStartRequest['career'],
        identifierType,
        identifierValue: identifierValue.trim(),
        startToken 
      })
      if (state.state === 'ACTIVE' || state.state === 'ADVANCED') {
        void navigate('/game', { replace: true })
      } else {
        onStarted(state)
      }
    } catch (e: any) {
      if (e.message?.includes('DUPLICATE_PARTICIPATION')) {
        setErr('Ya existe una participación activa para esta persona.')
      } else {
        setErr('No se pudo iniciar la sesión. Verificá los datos e intentá de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'rules') {
    return (
      <MobileShell>
        <BrandHeader />
        <main className="flex-1 flex flex-col justify-between px-6 pt-7 pb-8">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight leading-tight mb-6">
              Reglas del Juego
            </h1>
            <div className="space-y-3 text-sm text-foreground">
              <p><strong>Cómo jugar:</strong> seguí cada acertijo, encontrá el punto físico, escaneá su QR y respondé el desafío asignado.</p>
              <p><strong>Puntaje:</strong> correcta +100 · pista voluntaria -5.</p>
              <p><strong>Pista:</strong> aparece después del primer error y solo descuenta puntos si elegís verla.</p>
              <p>El tiempo no influye en tu puntaje.</p>
              <p>Jugá una sola vez y recorré la facu sin interrumpir clases ni actividades. La idea es divertirnos y que todos puedan jugar.</p>
              <p>Todas las estaciones están dentro de las instalaciones de la facultad.</p>
            </div>
          </div>
          <Button onClick={() => setStep('form')} className="mt-8 h-14 w-full">
            Entendido
          </Button>
        </main>
      </MobileShell>
    )
  }

  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 px-6 pt-7 pb-8">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight">
            Tus datos
          </h1>
          <p className="text-sm mt-2 text-muted">Completá este formulario para empezar la búsqueda.</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 flex flex-col gap-4" noValidate>
          {err && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
              {err}
            </div>
          )}
          
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="playerName" className="block text-xs font-bold text-foreground mb-1">Nombre</label>
              <input id="playerName" type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} disabled={submitting} className="w-full h-12 bg-surface border border-border rounded-lg px-3 text-base focus:border-brand focus:ring-1 focus:ring-brand" />
            </div>
            <div className="flex-1">
              <label htmlFor="lastName" className="block text-xs font-bold text-foreground mb-1">Apellido</label>
              <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={submitting} className="w-full h-12 bg-surface border border-border rounded-lg px-3 text-base focus:border-brand focus:ring-1 focus:ring-brand" />
            </div>
          </div>

          <div>
            <label htmlFor="career" className="block text-xs font-bold text-foreground mb-1">Carrera</label>
            <select id="career" value={career} onChange={(e) => setCareer(e.target.value as '' | SessionStartRequest['career'])} disabled={submitting} className="w-full h-12 bg-surface border border-border rounded-lg px-3 text-base focus:border-brand focus:ring-1 focus:ring-brand">
              <option value="">Seleccioná tu carrera</option><option value="ISI">ISI</option><option value="IEM">IEM</option><option value="IQ">IQ</option><option value="LAR">LAR</option><option value="TEC">TEC (Tecnicaturas)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">DNI</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={identifierValue} onChange={(e) => setIdentifierValue(e.target.value.replace(/\D/g, '').slice(0, 8))} disabled={submitting} className="w-full h-12 bg-surface border border-border rounded-lg px-3 text-base focus:border-brand focus:ring-1 focus:ring-brand" placeholder="DNI: 8 dígitos" />
            <p className="mt-1 text-xs text-muted">Ingresá los 8 dígitos de tu DNI.</p>
          </div>

          <Button type="submit" disabled={submitting || !playerName.trim() || !lastName.trim() || !career.trim() || !identifierValue.trim()} className="mt-4 h-14 w-full">
            {submitting ? 'Iniciando...' : 'Comenzar'}
          </Button>
        </form>
      </main>
    </MobileShell>
  )
}


function WrongCheckpointScreen({ onBack }: { onBack: () => void }) {
  return <MobileShell><BrandHeader /><main className="flex-1 px-6 pt-8"><h1 className="text-2xl font-black">Este no es tu próximo punto.</h1><p className="mt-3 text-muted">Volvé a leer la pista y buscá el QR correcto.</p><Button className="mt-6" onClick={onBack}>Ver mi pista</Button></main></MobileShell>
}

export function ChallengeScreen({ state, onResult }: { state: Extract<GameState, { state: 'CHALLENGE' | 'ANSWER_INCORRECT' }>, onResult: (state: GameState) => void }) {
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmHint, setConfirmHint] = useState(false)
  const [confirmReview, setConfirmReview] = useState(false)
  const [review, setReview] = useState<PlayerReviewStatus | null>(null)
  const [reviewNotice, setReviewNotice] = useState<{ reviewId: number; status: 'APPROVED' | 'REJECTED'; text: string } | null>(null)
  const [successResult, setSuccessResult] = useState<GameState | null>(null)
  const [successPhase, setSuccessPhase] = useState<'feedback' | 'reconciling' | 'retrying' | 'error'>('feedback')
  const [successRetryNonce, setSuccessRetryNonce] = useState(0)
  const [cooldownSeconds, setCooldownSeconds] = useState(state.cooldownRemaining ?? 0)
  const [reviewPollNonce, setReviewPollNonce] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpSubmitting, setHelpSubmitting] = useState(false)
  const [helpMessage, setHelpMessage] = useState('')
  const [confirmDamagedQr, setConfirmDamagedQr] = useState(false)
  const resultHandler = useRef(onResult)
  resultHandler.current = onResult
  const reviewAttemptId = state.state === 'ANSWER_INCORRECT' ? state.attemptId : undefined

  const [phase, setPhase] = useState<'A' | 'B'>('A')

  useEffect(() => {
    setSuccessResult(null)
    setSuccessPhase('feedback')
    setSuccessRetryNonce(0)
    setAnswer('')
    setError('')
    setSubmitting(false)
  }, [state.challengeId])

  useEffect(() => {
    setReview(null)
    setReviewNotice(null)
  }, [state.challengeId, reviewAttemptId])

  useEffect(() => {
    setCooldownSeconds(state.cooldownRemaining ?? 0)
  }, [state.challengeId, state.cooldownRemaining])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = window.setTimeout(() => setCooldownSeconds(seconds => Math.max(0, seconds - 1)), 1_000)
    return () => window.clearTimeout(timer)
  }, [cooldownSeconds])

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // If we've already answered incorrectly, or have hints, skip phase A
    if (state.state === 'ANSWER_INCORRECT' || state.hasHint || state.hint || prefersReducedMotion) {
      setPhase('B')
    } else {
      setPhase('A')
      const timer = setTimeout(() => setPhase('B'), 5000)
      return () => clearTimeout(timer)
    }
  }, [state.challengeId, state.state, state.hasHint, state.hint])

  useEffect(() => {
    if (!successResult) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fetchWithTimeout = async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([
          getGameState(),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('STATE_TIMEOUT')), 3_500) }),
        ])
      } finally {
        if (timeout) clearTimeout(timeout)
      }
    }
    const reconcile = async (attempt: number) => {
      if (stopped) return
      setSuccessPhase(attempt === 0 ? 'reconciling' : 'retrying')
      try {
        const current = await fetchWithTimeout()
        if (!stopped) resultHandler.current(current)
      } catch {
        if (stopped) return
        if (attempt === 0) {
          setSuccessPhase('retrying')
          timer = setTimeout(() => void reconcile(1), 800)
        } else {
          setSuccessPhase('error')
        }
      }
    }
    setSuccessPhase('feedback')
    timer = setTimeout(() => void reconcile(0), successRetryNonce > 0 || reducedMotion ? 0 : 700)
    return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [successResult, successRetryNonce])

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let pendingObserved = false
    const check = async () => {
      try {
        const status = await getSupportStatus()
        if (stopped) return
        const relevant = reviewAttemptId
          ? status.reviews.find(item => item.answer_attempt_id === reviewAttemptId) ?? null
          : status.reviews.find(item => item.challenge_id === state.challengeId && item.status === 'PENDING') ?? null
        setReview(relevant)
        if (relevant?.status === 'APPROVED') {
          pendingObserved = false
          setReviewNotice(isReviewAcknowledged(relevant.id) ? null : { reviewId: relevant.id, status: 'APPROVED', text: `¡Tu respuesta fue aprobada! Puntaje corregido: +${relevant.scoreCorrection}` })
          const current = await getGameState()
          if (!stopped) resultHandler.current(current)
          return
        }
        if (relevant?.status === 'REJECTED') {
          pendingObserved = false
          setReviewNotice(isReviewAcknowledged(relevant.id) ? null : { reviewId: relevant.id, status: 'REJECTED', text: 'Tu respuesta fue revisada y no fue aceptada.' })
          return
        }
        setReviewNotice(null)
        pendingObserved = relevant?.status === 'PENDING'
        if (pendingObserved) timer = setTimeout(check, 3_000)
      } catch {
        if (!stopped && pendingObserved) timer = setTimeout(check, 3_000)
      }
    }
    void check()
    return () => { stopped = true; if (timer) clearTimeout(timer) }
  }, [state.challengeId, reviewAttemptId, reviewPollNonce])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!answer.trim() || cooldownSeconds > 0) return
    setSubmitting(true); setError('')
    try {
      const next = await submitAnswer(state.challengeId, { answer: answer.trim() })
      if (next.state === 'ADVANCED' || next.state === 'COMPLETED') {
        setSuccessResult(next)
      } else {
        if (next.state === 'ANSWER_INCORRECT') setCooldownSeconds(next.cooldownRemaining ?? 10)
        onResult(next)
        setSubmitting(false)
      }
    }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 429 && cause.body.error === 'COOLDOWN_ACTIVE') {
        const remaining = Number(cause.body.remainingSeconds)
        setCooldownSeconds(Number.isFinite(remaining) && remaining > 0 ? Math.ceil(remaining) : 1)
        setError('')
      } else if (cause instanceof ApiError && [403, 404, 409].includes(cause.status)) {
        setError('El estado del desafío cambió. Estamos recuperando tu avance.')
        try { resultHandler.current(await getGameState()) } catch { setError('No pudimos recuperar el desafío. Intentá nuevamente.') }
      } else if (cause instanceof ApiError && cause.status >= 500) {
        setError('El servidor no pudo procesar la respuesta. Intentá nuevamente.')
      } else {
        setError('No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.')
      }
      setSubmitting(false)
    }
  }

  if (successResult) {
    return (
      <MobileShell>
        <BrandHeader rightElement={<GameplayRulesButton />} />
        <main onClick={() => setPhase('B')} className="flex-1 px-6 flex flex-col justify-center items-center text-center animate-scale-in motion-reduce:animate-none">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h1 className="text-2xl font-black text-foreground">¡Correcto!</h1>
          <p className="mt-2 text-green-700 font-bold">+100 puntos</p>
          {successPhase === 'retrying' && <p className="mt-4 text-sm text-muted" role="status">Volviendo a intentar cargar el siguiente paso…</p>}
          {successPhase === 'error' && <div className="mt-5 rounded border border-amber-300 bg-amber-50 p-4"><p className="font-bold text-amber-950">No pudimos cargar el siguiente paso.</p><p className="mt-1 text-sm text-amber-900">Tu respuesta ya quedó guardada.</p><Button type="button" className="mt-3" onClick={() => setSuccessRetryNonce(value => value + 1)}>Reintentar</Button></div>}
        </main>
      </MobileShell>
    )
  }

  if (phase === 'A') {
    return (
      <MobileShell>
        <BrandHeader rightElement={<GameplayRulesButton />} />
        <main onClick={() => setPhase('B')} className="flex-1 px-6 flex flex-col justify-center items-center text-center animate-scale-in motion-reduce:animate-none">
          <div className="mb-4 inline-flex px-3 py-1 bg-amber-100 text-amber-900 text-sm font-black rounded uppercase tracking-widest">DESAFÍO</div>
          <h1 className="text-3xl font-black text-foreground leading-tight">{state.question}</h1>
          <p className="mt-6 text-sm text-muted">Tocá para responder</p>
          <div className="mt-4 h-1 w-full max-w-xs overflow-hidden rounded-full bg-amber-100" aria-label="Tiempo restante para responder"><div className="challenge-intro-progress h-full rounded-full bg-brand" /></div>
        </main>
      </MobileShell>
    )
  }

  const pending = review?.status === 'PENDING'
  const oldPending = pending && Date.now() - new Date(review.created_at).getTime() >= 300_000
  return <MobileShell>
    <BrandHeader rightElement={<GameplayRulesButton />} />
    <main className="flex-1 px-6 pt-7 pb-8">
      <div className="flex justify-between">
        <p className="text-xs font-bold text-brand uppercase">{state.stepNumber === 0 ? 'Desafío inicial' : `Desafío ${state.stepNumber} de ${state.totalSteps}`}</p>
        <ScoreDisplay score={state.score} />
      </div>
      <div className="mt-6 rounded-xl border bg-white p-5"><span className="text-xs font-black text-brand">DESAFÍO</span><h1 className="mt-2 text-xl font-bold">{state.question}</h1></div>
      {state.state === 'ANSWER_INCORRECT' && <p className="mt-3 text-sm text-red-600">Respuesta incorrecta · -10</p>}
      {state.hint && <p className="mt-3 rounded bg-blue-50 p-3 text-sm">Pista: {state.hint}</p>}
      <form className="mt-5 flex flex-col gap-3" onSubmit={submit}>
        <input className="rounded border p-3" value={answer} onChange={e => setAnswer(e.target.value)} disabled={submitting} placeholder="Tu respuesta" autoFocus />
        <Button type="submit" disabled={submitting || cooldownSeconds > 0}>{submitting ? 'Enviando...' : 'Responder'}</Button>
      </form>
      {cooldownSeconds > 0 && <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950" role="status">Podés volver a intentar en {cooldownSeconds} s.</p>}
      <div className="mt-4 flex flex-col items-start gap-2 border-t pt-4">
        {state.hasHint && !confirmHint && <button className="text-sm font-bold text-brand underline" onClick={() => setConfirmHint(true)}>Ver pista (-5)</button>}
        {!pending && review?.answer_attempt_id !== reviewAttemptId && reviewAttemptId && <button className="text-sm text-brand underline" onClick={() => setConfirmReview(true)}>Creo que mi respuesta fue correcta</button>}
        <button className="text-sm text-neutral-600 underline" onClick={() => setHelpOpen(true)}>¿Necesitás ayuda?</button>
      </div>
      {confirmReview && reviewAttemptId && <div className="mt-3 rounded border bg-surface-warm p-3 text-sm">
        <p className="font-bold">Tu respuesta quedará en evaluación por Tutorías.</p>
        <button className="mt-3 rounded bg-brand px-3 py-2 text-white" onClick={async () => { await submitAnswerReview(reviewAttemptId); setConfirmReview(false); const status = await getSupportStatus(); setReview(status.reviews.find(item => item.answer_attempt_id === reviewAttemptId) ?? null); setReviewPollNonce(value => value + 1) }}>Enviar a revisión</button>
        <button className="ml-2" onClick={() => setConfirmReview(false)}>Seguir intentando</button>
      </div>}
      {confirmHint && <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
        <p>Revelar esta pista descuenta 5 puntos.</p>
        <button className="mt-2 rounded bg-amber-700 px-3 py-2 text-white" onClick={async () => { const next = await revealQuestionHint(); setConfirmHint(false); onResult(next) }}>Revelar pista</button>
        <button className="ml-2" onClick={() => setConfirmHint(false)}>Cancelar</button>
      </div>}
      {pending && <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm"><p className="font-bold">Respuesta en evaluación</p><p>Un tutor está revisándola. Podés seguir intentando mientras Tutorías revisa tu respuesta.</p>{oldPending && <p className="mt-2 font-medium">¿Todavía no tenés respuesta?<br />Acercate a la oficina de Tutorías y te ayudamos.</p>}</div>}
      {reviewNotice && review?.status !== 'PENDING' && <div className={`mt-4 rounded border p-3 text-sm ${reviewNotice.status === 'REJECTED' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}><span>{reviewNotice.text}</span><button className="ml-3 underline" onClick={() => { acknowledgeReview(reviewNotice.reviewId); setReviewNotice(null) }}>Cerrar</button></div>}
      {helpOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4"><div className="w-full rounded-xl bg-white p-5"><h2 className="font-bold">¿Necesitás ayuda?</h2><div className="mt-3 flex flex-col gap-2"><button disabled={helpSubmitting} className="rounded border p-3 text-left disabled:opacity-50" onClick={() => setHelpMessage('Este desafío ya está desbloqueado. Podés continuar respondiendo.')}>No puedo escanear el QR</button><button disabled={helpSubmitting} className="rounded border p-3 text-left disabled:opacity-50" onClick={() => { setHelpMessage(''); setConfirmDamagedQr(true) }}>El QR está dañado, fue quitado o no funciona</button><button disabled={helpSubmitting || !reviewAttemptId || pending} className="rounded border p-3 text-left disabled:opacity-50" onClick={() => { setHelpOpen(false); setConfirmReview(true) }}>Mi respuesta debería ser correcta</button><button disabled={helpSubmitting} className="rounded border p-3 text-left disabled:opacity-50" onClick={async () => { setHelpSubmitting(true); setHelpMessage(''); try { const result = await submitSupport('OTHER'); setHelpMessage(result.message ?? 'Avisamos a Tutorías.') } catch { setHelpMessage('No se pudo enviar el aviso. Intentá nuevamente.') } finally { setHelpSubmitting(false) } }}>Otro problema</button></div>{confirmDamagedQr && <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm"><p>Esto avisará a Tutorías que el QR está dañado, fue quitado o no funciona.</p><div className="mt-3 flex gap-2"><button disabled={helpSubmitting} className="rounded bg-brand px-3 py-2 font-bold text-white disabled:opacity-50" onClick={async () => { setHelpSubmitting(true); setHelpMessage(''); try { const result = await submitSupport('QR_DAMAGED'); setHelpMessage(result.message ?? 'Avisamos a Tutorías.'); setConfirmDamagedQr(false) } catch { setHelpMessage('No se pudo enviar el aviso. Intentá nuevamente.') } finally { setHelpSubmitting(false) } }}>{helpSubmitting ? 'Enviando…' : 'Enviar aviso'}</button><button disabled={helpSubmitting} className="rounded border px-3 py-2 font-bold" onClick={() => setConfirmDamagedQr(false)}>Cancelar</button></div></div>}{helpMessage && <p className="mt-3 text-sm font-bold text-brand" role="status">{helpMessage}</p>}<button disabled={helpSubmitting} className="mt-4 w-full rounded border p-2 font-bold disabled:opacity-50" onClick={() => { setHelpOpen(false); setConfirmDamagedQr(false); setHelpMessage('') }}>Cerrar</button></div></div>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </main>
  </MobileShell>
}
