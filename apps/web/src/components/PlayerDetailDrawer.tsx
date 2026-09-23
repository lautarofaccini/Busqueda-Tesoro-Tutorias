import { useEffect, useState } from 'react'
import { durationSeconds, elapsedSeconds, formatElapsed, formatEventDateTime, formatEventTime } from '../lib/eventTime'

export type PlayerDetail = {
  id: number
  playerName: string
  career: string | null
  identifierType: string
  identifierSuffix: string
  status: string
  currentState: 'RESPONDIENDO' | 'BUSCANDO_QR' | 'FINALIZADO'
  currentStep: number
  totalSteps: number
  startedAt: string
  completedAt: string | null
  score: number
  errors: number
  questionHints: number
  navigationHints: number
  pendingReview: boolean
  stateSince: string
  stateSinceSource: string
  currentQuestion: null | { checkpoint: string; question: string; assignedAt: string; hintUsedAt: string | null }
  destination: null | { checkpoint: string; clue: string }
  history: Array<{
    stepPosition: number
    checkpoint: string
    question: string
    assignedAt: string
    hintUsedAt: string | null
    routeHintUsedAt: string | null
    attempts: Array<{
      answer: string
      correct: boolean
      attemptedAt: string
      scoreEffect: number
      reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
      reviewRequestedAt: string | null
      reviewResolvedAt: string | null
      reviewCorrection: number
    }>
  }>
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

function reviewLabel(status: string | null) {
  if (status === 'PENDING') return 'pendiente'
  if (status === 'APPROVED') return 'aprobada'
  if (status === 'REJECTED') return 'rechazada'
  return ''
}

export function PlayerDetailDrawer({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    let stopped = false
    let timer: number | undefined
    const poll = async () => {
      let shouldContinue = true
      try {
        const response = await fetch(`/api/organizer/players/${sessionId}`)
        if (!response.ok) throw new Error('LOAD_FAILED')
        const next = await response.json() as PlayerDetail
        shouldContinue = next.currentState !== 'FINALIZADO'
        if (!stopped) {
          setDetail(next)
          setNow(Date.now())
          setError('')
        }
      } catch {
        if (!stopped) setError('No se pudo actualizar el detalle del participante.')
      } finally {
        if (!stopped && shouldContinue) timer = window.setTimeout(() => void poll(), 5_000)
      }
    }
    void poll()
    return () => { stopped = true; if (timer) window.clearTimeout(timer) }
  }, [sessionId])

  useEffect(() => {
    if (!detail || detail.currentState === 'FINALIZADO') return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [detail?.currentState])

  return <div className="fixed inset-0 z-50 bg-black/50" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-label="Detalle del participante" className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-neutral-100 p-4 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Detalle en vivo</p><h2 className="text-2xl font-black">{detail?.playerName ?? 'Cargando…'}</h2></div>
        <button type="button" className="rounded border bg-white px-3 py-2 font-bold" onClick={onClose}>Cerrar</button>
      </div>
      {error && <p role="status" className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!detail ? <p className="mt-6">Cargando detalle…</p> : <>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded bg-white p-3"><span className="text-neutral-500">Carrera</span><p className="font-bold">{detail.career || 'No informada'}</p></div>
          <div className="rounded bg-white p-3"><span className="text-neutral-500">Identificación</span><p className="font-bold">{detail.identifierType} ···{detail.identifierSuffix}</p></div>
          <div className="rounded bg-white p-3"><span className="text-neutral-500">Puntaje</span><p className="text-xl font-black text-orange-700">{detail.score}</p></div>
          <div className="rounded bg-white p-3"><span className="text-neutral-500">Progreso</span><p className="font-bold">Paso {Math.min(detail.currentStep, detail.totalSteps)} / {detail.totalSteps}</p></div>
          <div className="rounded bg-white p-3"><span className="text-neutral-500">Errores</span><p className="font-bold">{detail.errors}</p></div>
          <div className="rounded bg-white p-3"><span className="text-neutral-500">Pistas</span><p className="font-bold">{detail.questionHints} pregunta · {detail.navigationHints} recorrido</p></div>
        </div>

        <div className="mt-4 rounded border-2 border-blue-300 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{detail.currentState}</h3>{detail.pendingReview && <span className="rounded bg-amber-200 px-2 py-1 text-xs font-black text-amber-950">REVISIÓN PENDIENTE</span>}</div>
          {detail.currentState === 'FINALIZADO' && detail.completedAt ? <>
            <p className="mt-1 font-mono font-bold">Duración total: {formatElapsed(durationSeconds(detail.startedAt, detail.completedAt))}</p>
            <p className="text-xs text-neutral-600">Finalizó: {formatEventTime(detail.completedAt)}</p>
          </> : <>
            <p className="mt-1 font-mono font-bold">En este estado hace: {formatElapsed(elapsedSeconds(detail.stateSince, now))}</p>
            <p className="text-xs text-neutral-600">Desde: {formatEventTime(detail.stateSince)}</p>
          </>}
        </div>

        {detail.currentState === 'RESPONDIENDO' && detail.currentQuestion && <div className="mt-4 rounded border border-orange-300 bg-orange-50 p-4">
          <h3 className="font-black">Pregunta actual</h3>
          <p className="mt-2 text-sm"><strong>Checkpoint:</strong> {detail.currentQuestion.checkpoint}</p>
          <p className="mt-2 text-base">{detail.currentQuestion.question}</p>
          <p className="mt-2 text-sm">Pista de pregunta: <strong>{detail.currentQuestion.hintUsedAt ? 'usada' : 'no usada'}</strong></p>
        </div>}

        {detail.currentState === 'BUSCANDO_QR' && detail.destination && <div className="mt-4 rounded border border-green-300 bg-green-50 p-4">
          <h3 className="font-black">Buscando el próximo QR</h3>
          <p className="mt-2 text-sm"><strong>Destino esperado:</strong> {detail.destination.checkpoint}</p>
          <p className="mt-2 text-sm"><strong>Pista de navegación:</strong> {detail.destination.clue}</p>
        </div>}

        <div className="mt-4 rounded bg-white p-3 text-sm">
          <p><strong>Inicio:</strong> {formatEventDateTime(detail.startedAt)}</p>
          {detail.completedAt && <p><strong>Finalización:</strong> {formatEventDateTime(detail.completedAt)}</p>}
        </div>

        <h3 className="mt-6 text-lg font-black">Historial de preguntas y respuestas</h3>
        <div className="mt-3 space-y-3">
          {detail.history.map(item => <article key={item.stepPosition} className="rounded border bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-orange-700">{item.checkpoint}</p>
            <p className="mt-2"><strong>Pregunta:</strong> {item.question}</p>
            {(item.hintUsedAt || item.routeHintUsedAt) && <p className="mt-2 text-xs font-bold text-blue-800">{item.hintUsedAt ? 'Pista de pregunta usada' : ''}{item.hintUsedAt && item.routeHintUsedAt ? ' · ' : ''}{item.routeHintUsedAt ? 'Pista de recorrido usada' : ''}</p>}
            {!item.attempts.length ? <p className="mt-3 text-sm text-neutral-500">Sin respuestas todavía.</p> : <div className="mt-3 space-y-3">{item.attempts.map((attempt, index) => <div key={`${attempt.attemptedAt}-${index}`} className="border-t pt-3 text-sm">
              <p className="text-xs text-neutral-500">{formatEventTime(attempt.attemptedAt)}</p>
              <p className="break-words text-base">“{attempt.answer}”</p>
              <p className={attempt.correct ? 'font-bold text-green-700' : 'font-bold text-red-700'}>{attempt.correct ? 'Correcta' : 'Incorrecta'} · {signed(attempt.scoreEffect)}</p>
              {attempt.reviewStatus && <p className="mt-1 font-bold text-blue-800">Revisión: {reviewLabel(attempt.reviewStatus)}{attempt.reviewCorrection ? ` · corrección ${signed(attempt.reviewCorrection)}` : ''}</p>}
            </div>)}</div>}
          </article>)}
          {!detail.history.length && <p className="rounded border bg-white p-4 text-sm text-neutral-500">Todavía no hay preguntas asignadas.</p>}
        </div>
      </>}
    </section>
  </div>
}
