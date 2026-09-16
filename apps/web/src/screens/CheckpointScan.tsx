import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState } from '@busqueda-tesoro/shared'
import { scanToken, startSession, submitAnswer } from '../api/client'
import { MobileShell } from '../components/MobileShell'
import { BrandHeader } from '../components/BrandHeader'
import { Button } from '../components/Button'

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
          <p className="text-sm text-muted font-medium">Verificando código QR…</p>
        </main>
      </MobileShell>
    )
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
  const [playerName, setPlayerName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!playerName.trim()) return
    setSubmitting(true)
    setErr(null)
    try {
      const state = await startSession({ playerName: playerName.trim(), startToken })
      if (state.state === 'ACTIVE' || state.state === 'ADVANCED') {
        void navigate('/game', { replace: true })
      } else {
        onStarted(state)
      }
    } catch {
      setErr('No se pudo iniciar la sesión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 flex flex-col justify-between px-6 pt-7 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-xs bg-brand" aria-hidden="true" />
            <span className="text-xs font-bold tracking-widest text-brand uppercase">
              Punto de partida · Tutorías
            </span>
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight leading-tight">
            Búsqueda del tesoro
          </h1>
          <div className="flex items-center gap-1.5 mt-3 mb-6" aria-hidden="true">
            <div className="h-1 w-12 bg-brand rounded-full" />
            <div className="h-1 w-4 bg-yellow rounded-full" />
          </div>
          <div className="border-l-4 border-l-brand bg-surface border border-border rounded-r-lg p-4 shadow-xs">
            <p className="text-sm text-foreground font-semibold">
              QR de inicio escaneado correctamente en Tutorías.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="my-auto py-6 flex flex-col gap-4" noValidate>
          <div className="bg-surface border border-border rounded-xl p-5 shadow-xs flex flex-col gap-4">
            {err && (
              <p className="text-sm text-amber-900 bg-amber-100/80 rounded-lg p-3 font-medium">{err}</p>
            )}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="player-name"
                className="text-sm font-bold text-foreground flex items-center justify-between"
              >
                <span>Tu nombre</span>
                <span className="text-xs font-mono font-normal text-muted">Requerido</span>
              </label>
              <input
                id="player-name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ingresá tu nombre"
                autoComplete="given-name"
                className="w-full min-h-[52px] px-4 py-3 rounded-lg border-2 border-border text-base text-foreground bg-surface-warm placeholder:text-muted/60 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all font-medium"
              />
            </div>
            <Button type="submit" disabled={!playerName.trim() || submitting}>
              {submitting ? 'Iniciando…' : 'Comenzar'}
            </Button>
          </div>
        </form>

        <footer className="pt-4 border-t border-border/70 flex items-center justify-between text-xs text-muted">
          <span className="font-bold tracking-wider uppercase text-[10px]">UTN FRRe · Tutorías</span>
          <span className="font-mono text-[10px] text-muted/70">Registro de participante</span>
        </footer>
      </main>
    </MobileShell>
  )
}

interface WrongCheckpointScreenProps {
  onBack: () => void
}

function WrongCheckpointScreen({ onBack }: WrongCheckpointScreenProps) {
  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 flex flex-col justify-between px-6 pt-6 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-100/90 border border-amber-300/80 mb-3">
            <span className="w-2 h-2 rounded-xs bg-amber" aria-hidden="true" />
            <span className="text-xs font-mono font-bold tracking-wider text-amber-950 uppercase">
              Punto no correspondiente
            </span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight">
            Este no es tu próximo punto.
          </h1>
          <div className="flex items-center gap-1.5 mt-2.5 mb-5" aria-hidden="true">
            <div className="h-1 w-12 bg-amber rounded-full" />
            <div className="h-1 w-4 bg-yellow rounded-full" />
          </div>
          <div className="border border-border-warm bg-surface-warm rounded-xl p-5 border-l-4 border-l-amber shadow-xs">
            <p className="text-base text-foreground font-semibold leading-relaxed">Seguí la pista actual.</p>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Este código QR pertenece a otra parada del recorrido. Revisá tu pista activa para encontrar el lugar correcto.
            </p>
          </div>
        </div>
        <div className="pt-4">
          <Button variant="primary" onClick={onBack}>
            Volver a mi misión
          </Button>
        </div>
      </main>
    </MobileShell>
  )
}

interface ChallengeScreenProps {
  state: GameState & { state: 'CHALLENGE' | 'ANSWER_INCORRECT' }
  onResult: (state: GameState) => void
}

function ChallengeScreen({ state, onResult }: ChallengeScreenProps) {
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isIncorrect = state.state === 'ANSWER_INCORRECT'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!answer.trim()) return
    setSubmitting(true)
    try {
      const result = await submitAnswer(state.challengeId, { answer: answer.trim() })
      onResult(result)
      if (result.state === 'ANSWER_INCORRECT') {
        setAnswer('')
      }
    } catch {
      // Network error — keep form, let user retry
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MobileShell>
      <BrandHeader />
      <main className="flex-1 flex flex-col justify-between px-6 pt-6 pb-8">
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-100/90 border border-amber-300/80">
              <span className="w-2 h-2 rounded-xs bg-brand" aria-hidden="true" />
              <span className="text-xs font-mono font-bold tracking-wider text-amber-950 uppercase">
                MISIÓN {state.stepNumber} DE {state.totalSteps}
              </span>
            </div>
            <span className="text-xs font-mono font-semibold text-muted">EN CURSO</span>
          </div>

          <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight">
            Respondé la pregunta
          </h1>
          <div className="flex items-center gap-1.5 mt-2.5 mb-5" aria-hidden="true">
            <div className="h-1 w-12 bg-brand rounded-full" />
            <div className="h-1 w-4 bg-yellow rounded-full" />
          </div>

          <div className="border border-border-warm bg-surface-warm rounded-xl p-5 border-l-4 border-l-brand shadow-xs">
            <p className="text-base text-foreground font-medium leading-relaxed">
              {state.question}
            </p>
          </div>

          {isIncorrect && (
            <div className="mt-3 border-l-4 border-l-amber bg-amber-50/80 border border-amber-200 rounded-r-lg p-4">
              <p className="text-sm text-amber-900 font-semibold">
                Respuesta incorrecta. Intentá de nuevo.
              </p>
            </div>
          )}
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="my-auto py-6 flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="answer" className="text-sm font-bold text-foreground">
              Tu respuesta
            </label>
            <input
              id="answer"
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Ingresá tu respuesta"
              autoComplete="off"
              autoCapitalize="off"
              className="w-full min-h-[52px] px-4 py-3 rounded-lg border-2 border-border text-base text-foreground bg-surface-warm placeholder:text-muted/60 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all font-medium"
            />
          </div>
          <Button type="submit" disabled={!answer.trim() || submitting}>
            {submitting ? 'Verificando…' : 'Enviar respuesta'}
          </Button>
        </form>
      </main>
    </MobileShell>
  )
}
