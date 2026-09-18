import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState } from '@busqueda-tesoro/shared'
import { scanToken, startSession, submitAnswer, revealQuestionHint, submitAnswerReview } from '../api/client'
import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
import { Button } from '../components/Button'
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
        <main className="flex-1 flex flex-col justify-between px-6 pt-7 pb-8">
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
            void navigate('/game', { replace: true })
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
  const [career, setCareer] = useState('')
  const [identifierType, setIdentifierType] = useState<'LEGAJO' | 'DNI'>('LEGAJO')
  const [identifierValue, setIdentifierValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!playerName.trim() || !lastName.trim() || !career.trim() || !identifierValue.trim()) return
    setSubmitting(true)
    setErr(null)
    try {
      const state = await startSession({ 
        playerName: playerName.trim(), 
        lastName: lastName.trim(),
        career: career.trim(),
        identifierType,
        identifierValue: identifierValue.trim(),
        startToken 
      })
      if (state.state === 'ACTIVE' || state.state === 'ADVANCED' || state.state === 'CHALLENGE') {
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
            <ul className="space-y-4 text-sm font-medium text-foreground">
              <li className="flex gap-3">
                <span className="text-brand">1.</span>
                <span>No se debe interrumpir el funcionamiento normal de la facultad.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-brand">2.</span>
                <span>Solo se puede participar una vez por alumno.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-brand">3.</span>
                <span>Gana quien obtenga el mejor puntaje.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-brand">4.</span>
                <span>En caso de empate en posiciones de premio, se realizará una trivia de preguntas generales al día siguiente.</span>
              </li>
            </ul>
            <div className="mt-8 p-4 bg-surface-warm rounded-lg border border-border">
              <p className="text-sm font-bold text-center text-foreground uppercase tracking-wider">Duración estimada: hasta 10 minutos</p>
            </div>
          </div>
          <Button onClick={() => setStep('form')} className="mt-8 h-14 w-full">
            Entendido, Continuar
          </Button>
        </main>
      </MobileShell>
    )
  }

  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 flex flex-col justify-between px-6 pt-7 pb-8">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight">
            Tus datos
          </h1>
          <p className="text-sm mt-2 text-muted">Completá este formulario para empezar la búsqueda.</p>
          <p className="text-xs mt-2 text-muted">Correcta +100 · Incorrecta -10 · Pista voluntaria -5.</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 flex flex-col gap-4" noValidate>
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
            <input id="career" type="text" value={career} onChange={(e) => setCareer(e.target.value)} disabled={submitting} className="w-full h-12 bg-surface border border-border rounded-lg px-3 text-base focus:border-brand focus:ring-1 focus:ring-brand" />
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1">Identificación</label>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setIdentifierType('LEGAJO')} className={`flex-1 py-2 rounded text-sm font-bold ${identifierType === 'LEGAJO' ? 'bg-neutral-800 text-white' : 'bg-surface border'}`}>LEGAJO</button>
              <button type="button" onClick={() => setIdentifierType('DNI')} className={`flex-1 py-2 rounded text-sm font-bold ${identifierType === 'DNI' ? 'bg-neutral-800 text-white' : 'bg-surface border'}`}>DNI</button>
            </div>
            <input type="text" inputMode="numeric" value={identifierValue} onChange={(e) => setIdentifierValue(e.target.value)} disabled={submitting} className="w-full h-12 bg-surface border border-border rounded-lg px-3 text-base focus:border-brand focus:ring-1 focus:ring-brand" placeholder={identifierType === 'LEGAJO' ? 'Nº de Legajo' : 'Nº de DNI'} />
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

function ChallengeScreen({ state, onResult }: { state: Extract<GameState, { state: 'CHALLENGE' | 'ANSWER_INCORRECT' }>, onResult: (state: GameState) => void }) {
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmHint, setConfirmHint] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!answer.trim()) return
    setSubmitting(true); setError('')
    try { onResult(await submitAnswer(state.challengeId, { answer: answer.trim() })) }
    catch { setError('No se pudo enviar la respuesta. Intentá nuevamente.') }
    finally { setSubmitting(false) }
  }
  return <MobileShell><BrandHeader /><main className="flex-1 px-6 pt-7 pb-8"><div className="flex justify-between"><p className="text-xs font-bold text-brand uppercase">{state.stepNumber === 0 ? 'Desafío inicial' : `Desafío ${state.stepNumber} de ${state.totalSteps}`}</p><p className="text-xs font-bold">Puntos: {state.score}</p></div><p className="mt-1 text-xs text-muted">Correcta +100 · Incorrecta -10 · Pista -5</p><h1 className="mt-3 text-xl font-bold">{state.question}</h1>{state.state === 'ANSWER_INCORRECT' && <><p className="mt-4 text-red-600">La respuesta no es correcta. Probá otra vez.</p>{state.attemptId && <button className="mt-3 text-sm font-bold underline" onClick={async () => { try { await submitAnswerReview(state.attemptId); setError('Tu revisión quedó pendiente.') } catch { setError('No se pudo solicitar la revisión.') } }}>Creo que mi respuesta era correcta</button>}</>}{state.hint && <p className="mt-4 rounded bg-blue-50 p-3 text-sm">Pista: {state.hint}</p>}{state.hasHint && !confirmHint && <button className="mt-4 rounded border px-3 py-2 text-sm font-bold" onClick={() => setConfirmHint(true)}>Ver pista (-5 puntos)</button>}{confirmHint && <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm"><p>Revelar esta pista descuenta 5 puntos. ¿Continuar?</p><button className="mt-2 rounded bg-amber-700 px-3 py-2 text-white" onClick={async () => { try { onResult(await revealQuestionHint()) } catch { setError('No se pudo revelar la pista.') } }}>Revelar pista (-5)</button><button className="ml-2" onClick={() => setConfirmHint(false)}>Cancelar</button></div>}{error && <p className="mt-4 text-red-600">{error}</p>}<form className="mt-6 flex flex-col gap-3" onSubmit={submit}><input className="border rounded p-3" value={answer} onChange={e => setAnswer(e.target.value)} disabled={submitting} placeholder="Tu respuesta" /><Button type="submit" disabled={submitting}>{submitting ? 'Enviando...' : 'Responder'}</Button></form></main></MobileShell>
}
