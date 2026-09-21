import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState, SessionStartRequest } from '@busqueda-tesoro/shared'
import { scanToken, startSession, submitAnswer, revealQuestionHint, submitAnswerReview } from '../api/client'
import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
import { Button } from '../components/Button'
import { ScoreDisplay } from '../components/ScoreDisplay'
import { EventPausedEndedView } from '../components/EventPausedEndedView'

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
  if (!state) return null

  if (state.state === 'EVENT_PAUSED' || state.state === 'EVENT_ENDED') {
    return <EventPausedEndedView state={state.state} />
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error || !gameState) {
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
          } else if (next.state === 'ADVANCED') {
            void navigate('/game', { replace: true, state: { scoreFeedback: '+100 puntos' } })
          } else {
            setGameState(next)
          }
        }}
      />
    )
  }

  return null
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
  const [status, setStatus] = useState<'idle' | 'success'>('idle')

  const [phase, setPhase] = useState<'A' | 'B'>('A')

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // If we've already answered incorrectly, or have hints, skip phase A
    if (state.state === 'ANSWER_INCORRECT' || state.hasHint || state.hint || prefersReducedMotion) {
      setPhase('B')
    } else {
      const timer = setTimeout(() => setPhase('B'), 5000)
      return () => clearTimeout(timer)
    }
  }, [state.challengeId, state.state, state.hasHint, state.hint])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!answer.trim()) return
    setSubmitting(true); setError('')
    try {
      const next = await submitAnswer(state.challengeId, { answer: answer.trim() })
      if (next.state === 'ADVANCED' || next.state === 'COMPLETED') {
        setStatus('success')
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        setTimeout(() => onResult(next), reducedMotion ? 0 : 700)
      } else {
        onResult(next)
        setSubmitting(false)
      }
    }
    catch { setError('No se pudo enviar la respuesta. Intentá nuevamente.'); setSubmitting(false) }
  }

  if (status === 'success') {
    return (
      <MobileShell>
        <BrandHeader />
        <main onClick={() => setPhase('B')} className="flex-1 px-6 flex flex-col justify-center items-center text-center animate-scale-in motion-reduce:animate-none">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h1 className="text-2xl font-black text-foreground">¡Correcto!</h1>
          <p className="mt-2 text-green-700 font-bold">+100 puntos</p>
        </main>
      </MobileShell>
    )
  }

  if (phase === 'A') {
    return (
      <MobileShell>
        <BrandHeader />
        <main className="flex-1 px-6 flex flex-col justify-center items-center text-center animate-scale-in motion-reduce:animate-none">
          <div className="mb-4 inline-flex px-3 py-1 bg-amber-100 text-amber-900 text-sm font-black rounded uppercase tracking-widest">DESAFÍO</div>
          <h1 className="text-3xl font-black text-foreground leading-tight">{state.question}</h1>
          <p className="mt-6 text-sm text-muted">Tocá para responder</p>
        </main>
      </MobileShell>
    )
  }

  return <MobileShell><BrandHeader /><main className="flex-1 px-6 pt-7 pb-8"><div className="flex justify-between"><p className="text-xs font-bold text-brand uppercase">{state.stepNumber === 0 ? 'Desafío inicial' : `Desafío ${state.stepNumber} de ${state.totalSteps}`}</p><p className="text-xs font-bold"><ScoreDisplay score={state.score} /></p></div><p className="mt-1 text-xs text-muted">Correcta +100 · Incorrecta -10 · Pista -5</p>

  <div className="mt-6 p-6 bg-white border border-border shadow-sm rounded-xl animate-scale-in motion-reduce:animate-none">
    <div className="mb-4 inline-flex px-2 py-1 bg-amber-100 text-amber-900 text-xs font-black rounded uppercase tracking-widest">DESAFÍO</div>
    <h1 className="text-xl font-bold leading-snug">{state.question}</h1>
  </div>{state.state === 'ANSWER_INCORRECT' && <><p className="mt-4 text-red-600">La respuesta no es correcta. Probá otra vez.</p>{state.attemptId && <button className="mt-3 text-sm text-brand underline" onClick={() => setConfirmReview(true)}>Creo que mi respuesta fue correcta</button>}{confirmReview && <div className="mt-3 rounded border bg-surface-warm p-3 text-sm"><p className="font-bold">Tu respuesta quedará en evaluación por Tutorías.</p><p className="mt-1">Podés enviarla para revisión o seguir intentando con la penalidad actual.</p><button className="mt-3 rounded bg-brand px-3 py-2 font-bold text-white" onClick={async () => { try { await submitAnswerReview(state.attemptId); setConfirmReview(false); setError('Respuesta en evaluación. Un tutor está revisando tu respuesta.') } catch { setError('No se pudo solicitar la revisión.') } }}>Enviar a revisión</button><button className="ml-2" onClick={() => setConfirmReview(false)}>Seguir intentando</button></div>}</>}{state.hint && <p className="mt-4 rounded bg-blue-50 p-3 text-sm">Pista: {state.hint}</p>}{state.hasHint && !confirmHint && <button className="mt-4 rounded border px-3 py-2 text-sm font-bold" onClick={() => setConfirmHint(true)}>Ver pista (-5 puntos)</button>}{confirmHint && <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm"><p>Revelar esta pista descuenta 5 puntos. ¿Continuar?</p><button className="mt-2 rounded bg-amber-700 px-3 py-2 text-white" onClick={async () => { try { const next = await revealQuestionHint(); setConfirmHint(false); onResult(next) } catch { setError('No se pudo revelar la pista.') } }}>Revelar pista (-5)</button><button className="ml-2" onClick={() => setConfirmHint(false)}>Cancelar</button></div>}{error && <p className="mt-4 text-red-600">{error}</p>}<form className="mt-6 flex flex-col gap-3 animate-scale-in motion-reduce:animate-none" onSubmit={submit}><input className="border rounded p-3" value={answer} onChange={e => setAnswer(e.target.value)} disabled={submitting} placeholder="Tu respuesta" autoFocus /><Button type="submit" disabled={submitting}>{submitting ? 'Enviando...' : 'Responder'}</Button></form></main></MobileShell>
}
