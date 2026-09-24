import { useEffect, useState } from 'react'
import { PlayerDetailDrawer } from '../components/PlayerDetailDrawer'
import { formatElapsed, formatEventDateTime } from '../lib/eventTime'

const statusLabel: Record<string, string> = { DRAFT: 'Borrador', LIVE: 'En vivo', PAUSED: 'Pausada', CLOSING: 'Cierre en curso', ENDED: 'Finalizada' }
const metric = (value: unknown) => value === null || value === undefined ? '—' : String(value)

function Bar({ value, max }: { value: number; max: number }) {
  return <div className="mt-1 h-2 overflow-hidden rounded bg-neutral-200"><div className="h-full rounded bg-orange-500" style={{ width: `${max ? Math.max(3, value * 100 / max) : 0}%` }} /></div>
}

export function OrganizerView({ isEmbedded }: { isEmbedded?: boolean } = {}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [runs, setRuns] = useState<any[]>([])
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionToInvalidate, setSessionToInvalidate] = useState<number | null>(null)
  const [invalidationReason, setInvalidationReason] = useState('')
  const [sessionToRelease, setSessionToRelease] = useState<number | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [showTechnical, setShowTechnical] = useState(false)
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'PENDING' | 'REVIEWED'>('ALL')

  const loadAnalytics = async (runId: number) => {
    const response = await fetch(`/api/organizer/runs/${runId}/analytics`)
    if (!response.ok) throw new Error('ANALYTICS_LOAD_FAILED')
    setData(await response.json())
  }

  const fetchResults = async (preferredRunId?: number | null) => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/organizer/runs')
      if (response.status === 401) setIsAuthenticated(false)
      else if (response.ok) {
        const body = await response.json()
        setIsAuthenticated(true)
        // Compatibility with pre-edition local fixtures.
        if (!Array.isArray(body.runs)) setData(body)
        else {
          setRuns(body.runs)
          const chosen = preferredRunId ?? selectedRunId ?? body.runs.find((run: any) => run.isCurrent)?.id ?? body.runs[0]?.id
          if (chosen) { setSelectedRunId(Number(chosen)); await loadAnalytics(Number(chosen)) }
        }
      } else setError('No se pudieron cargar los resultados.')
    } catch { setError('No se pudieron cargar los resultados.') }
    setLoading(false)
  }

  useEffect(() => { void fetchResults() }, [])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/organizer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      if (response.ok) await fetchResults()
      else setError(response.status === 429 ? 'Demasiados intentos. Intentá nuevamente en unos instantes.' : 'No se pudo autenticar.')
    } catch { setError('Error de red.') }
    setLoading(false)
  }

  const handleInvalidate = async () => {
    if (!sessionToInvalidate || !invalidationReason.trim()) return
    await fetch(`/api/admin/sessions/${sessionToInvalidate}/invalidate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: invalidationReason.trim() }) })
    setSessionToInvalidate(null); setInvalidationReason(''); await fetchResults(selectedRunId)
  }
  const handleRelease = async () => {
    if (!sessionToRelease) return
    await fetch(`/api/admin/sessions/${sessionToRelease}/release`, { method: 'POST' })
    setSessionToRelease(null); await fetchResults(selectedRunId)
  }

  if (!isAuthenticated && !isEmbedded) return <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4"><form onSubmit={handleLogin} className="w-full max-w-sm rounded-lg bg-white p-6 shadow"><h2 className="mb-4 text-xl font-bold">Acceso de organizador</h2>{error && <p className="mb-4 text-sm text-red-600">{error}</p>}<label className="text-sm font-bold" htmlFor="organizer-username">Usuario</label><input id="organizer-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} className="mb-4 mt-1 w-full rounded border p-2" required /><label className="text-sm font-bold" htmlFor="organizer-password">Contraseña</label><input id="organizer-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mb-4 mt-1 w-full rounded border p-2" required /><button className="w-full rounded bg-orange-600 p-2 text-white" disabled={loading}>{loading ? 'Verificando…' : 'Entrar'}</button></form></div>
  if (loading && !data) return <div className="p-4">Cargando resultados…</div>
  if (!data) return <div className="p-4 text-red-700">{error || 'No hay datos disponibles.'}</div>

  const maxCareer = Math.max(0, ...(data.careers ?? []).map((career: any) => career.participants))
  const run = data.run
  const filteredRanking = (data.ranking ?? []).filter((player: any) => auditFilter === 'ALL' || player.auditStatus === auditFilter)
  return <div className={isEmbedded ? '' : 'min-h-screen bg-neutral-100 p-4 text-neutral-900'}><div className="mx-auto max-w-7xl">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black">Resultados del evento</h1>{run && <p className="mt-1 text-sm text-neutral-600">{run.name} · {statusLabel[run.effectiveStatus] ?? run.effectiveStatus}</p>}</div><button type="button" onClick={() => void fetchResults(selectedRunId)} className="rounded border bg-white px-3 py-2 text-sm font-bold">Actualizar</button></div>

    {runs.length > 0 && <label className="mb-6 block rounded border bg-white p-4 font-bold">Edición<select aria-label="Edición" value={selectedRunId ?? ''} onChange={event => void fetchResults(Number(event.target.value))} className="mt-2 w-full rounded border p-3 font-normal sm:max-w-md">{runs.map(option => <option key={option.id} value={option.id}>{option.name} — {statusLabel[option.effectiveStatus] ?? option.effectiveStatus}{option.isCurrent ? ' (actual)' : ''}</option>)}</select>{run && <span className="mt-2 block text-xs font-normal text-neutral-500">Inicio: {run.startedAt ? formatEventDateTime(run.startedAt) : 'sin iniciar'} · Fin: {run.endedAt ? formatEventDateTime(run.endedAt) : run.effectiveStatus === 'ENDED' ? 'fin efectivo por plazo' : '—'}</span>}</label>}

    <section aria-label="Indicadores generales" className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">{[
      ['Participantes totales', data.totals.all, 'text-orange-700'], ['Completaron', data.totals.completed, 'text-green-700'], ['No completaron', data.totals.incomplete ?? 0, 'text-red-700'], ['Invalidados', data.totals.invalidated ?? 0, 'text-neutral-700'], ['Finalización', data.totals.completionRate ?? (data.totals.valid ? Math.round(data.totals.completed * 100 / data.totals.valid) : 0), 'text-blue-700'],
    ].map(([label, value, color], index) => <div key={String(label)} className="rounded bg-white p-4 text-center shadow"><p className={`text-3xl font-black ${color}`}>{value}{index === 4 ? '%' : ''}</p><p className="text-xs font-bold uppercase text-neutral-500">{label}</p></div>)}</section>

    {data.globalPerformance && <section className="mb-8"><h2 className="mb-3 text-xl font-black">Rendimiento global</h2><div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[
      ['Puntaje promedio', data.globalPerformance.averageCompletedScore], ['Mediana', data.globalPerformance.medianCompletedScore], ['Errores promedio', data.globalPerformance.averageWrongAnswers], ['Pistas promedio', data.globalPerformance.averageHints], ['Duración promedio', data.globalPerformance.averageCompletionDurationSec === null ? null : formatElapsed(data.globalPerformance.averageCompletionDurationSec)], ['Finalización más rápida', data.globalPerformance.fastestCompletionSec === null ? null : formatElapsed(data.globalPerformance.fastestCompletionSec)],
    ].map(([label, value]) => <div key={String(label)} className="rounded border bg-white p-3"><p className="text-xs font-bold uppercase text-neutral-500">{label}</p><p className="mt-1 text-xl font-black">{metric(value)}</p></div>)}</div><p className="mt-2 text-xs text-neutral-500">Puntaje y duración: n={data.globalPerformance.sample} finalistas válidos. La finalización más rápida es descriptiva y no desempata.</p></section>}

    {data.highlights && <section className="mb-8"><h2 className="mb-3 text-xl font-black">Destacados</h2><div className="grid gap-3 md:grid-cols-3">{[
      ['Mayor participación', data.highlights.mostParticipation, 'participantes'], ['Mayor puntaje acumulado', data.highlights.mostTotalScore, 'puntos'], ['Mayor puntaje promedio', data.highlights.mostAverageScore, 'puntos promedio'],
    ].map(([label, highlight, unit]: any) => <div key={label} className="rounded border-l-4 border-orange-500 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-neutral-500">{label}</p><p className="mt-1 font-black">{highlight.careers.join(' · ') || 'Sin datos'}</p><p className="text-sm">{highlight.value} {unit}</p></div>)}</div></section>}

    {(data.careers?.length ?? 0) > 0 && <section className="mb-8"><h2 className="mb-3 text-xl font-black">Resultados por carrera</h2><div className="grid gap-3 lg:grid-cols-2">{data.careers.map((career: any) => <article key={career.career} className="rounded bg-white p-4 shadow-sm"><div className="flex justify-between gap-2"><h3 className="text-lg font-black">{career.career}</h3><span className="font-bold">{career.participants} · {career.sharePercent}%</span></div><Bar value={career.participants} max={maxCareer} /><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-neutral-500">Completaron / no</dt><dd className="font-bold">{career.completed} / {career.incomplete} · {career.completionRate}%</dd></div><div><dt className="text-neutral-500">Invalidados</dt><dd className="font-bold">{career.invalidated ?? 0}</dd></div><div><dt className="text-neutral-500">Puntaje total</dt><dd className="font-bold">{career.totalScore}</dd></div><div><dt className="text-neutral-500">Puntaje promedio</dt><dd className="font-bold">{metric(career.averageScore)} <small>(n={career.scoreSample})</small></dd></div><div><dt className="text-neutral-500">Duración promedio</dt><dd className="font-bold">{career.averageCompletionDurationSec === null ? '—' : formatElapsed(career.averageCompletionDurationSec)} <small>(n={career.durationSample})</small></dd></div><div><dt className="text-neutral-500">Errores promedio</dt><dd className="font-bold">{career.averageWrongAnswers} <small>(n={career.behaviorSample})</small></dd></div><div><dt className="text-neutral-500">Pistas promedio</dt><dd className="font-bold">{career.averageQuestionHints} <small>(n={career.behaviorSample})</small></dd></div></dl></article>)}</div></section>}

    <section className="mb-8"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><h2 className="text-xl font-black">Ranking individual · completaron</h2><label className="text-xs font-bold">Auditoría<select aria-label="Filtrar auditoría" value={auditFilter} onChange={event => setAuditFilter(event.target.value as typeof auditFilter)} className="ml-2 rounded border bg-white p-2 font-normal"><option value="ALL">Todas</option><option value="PENDING">Pendientes</option><option value="REVIEWED">Revisadas</option></select></label></div><div className="grid gap-3">{!filteredRanking.length && <p className="rounded bg-white p-4 text-neutral-500">No hay participantes para este filtro.</p>}{filteredRanking.map((player: any) => <article key={player.id} className="rounded bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black text-blue-700">#{player.rank}{player.isTied ? ' · EMPATE' : ''}</p><h3 className="font-black">{player.playerName}</h3><p className="text-sm text-neutral-500">{player.career || 'Sin carrera'} · {player.identifierType} ···{player.identifierSuffix}</p></div><div className="text-right"><p className="text-2xl font-black text-orange-700">{player.score}</p>{player.manualAdjustmentCount > 0 && <p className="text-xs font-bold text-amber-700">{player.manualAdjustmentTotal > 0 ? '+' : ''}{player.manualAdjustmentTotal} manual</p>}</div></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span>Errores: <strong>{player.wrongCount}</strong></span><span>Pistas: <strong>{player.hintsUsed}</strong></span><span>Auditoría: <strong>{player.auditStatus === 'REVIEWED' ? 'REVISADA' : 'PENDIENTE'}</strong></span><span className="font-mono">FINALIZADO · {formatElapsed(player.durationSec)} total</span></div><div className="mt-3 flex gap-2"><button onClick={() => setSelectedSessionId(player.id)} className="rounded bg-blue-100 px-3 py-2 text-xs font-bold text-blue-800">Ver detalle</button><button onClick={() => setSessionToInvalidate(player.id)} className="rounded bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Invalidar</button></div></article>)}</div></section>

    {(data.incomplete?.length ?? 0) > 0 && <PlayerGroup title="No completaron" players={data.incomplete} onDetail={setSelectedSessionId} />}
    {(data.active?.length ?? 0) > 0 && <PlayerGroup title="En juego" players={data.active} onDetail={setSelectedSessionId} />}
    {(data.invalidated?.length ?? 0) > 0 && <section className="mb-8 rounded border border-red-200 bg-red-50 p-4"><h2 className="font-black">Participaciones invalidadas · {data.invalidated.length}</h2><p className="mt-1 text-xs">Se conservan, pero no integran KPIs, ranking ni estadísticas competitivas.</p>{data.invalidated.map((player: any) => <div key={player.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-red-200 pt-2 text-sm"><span>{player.playerName} · {player.invalidationReason}</span><button onClick={() => setSessionToRelease(player.id)} className="rounded border bg-white px-2 py-1">Rehabilitar participación</button></div>)}</section>}

    {(data.questions || data.checkpoints) && <section className="mb-8 rounded bg-white shadow-sm"><button type="button" aria-expanded={showTechnical} onClick={() => setShowTechnical(value => !value)} className="flex w-full justify-between p-4 text-left font-black"><span>Preguntas y checkpoints</span><span>{showTechnical ? 'Ocultar' : 'Ver análisis'}</span></button>{showTechnical && <div className="border-t p-4"><h3 className="font-black">Por pregunta</h3><div className="mt-2 grid gap-2">{data.questions.map((question: any) => <div key={question.questionId} className="rounded border p-3 text-sm"><p className="font-bold">{question.question}</p><p className="text-neutral-500">{question.checkpoint}</p><p className="mt-1">Recibieron: {question.received} · Primera correcta: {question.firstAttemptCorrect} ({question.firstAttemptCorrectRate}%) · Errores: {question.wrongAttempts} · Pistas: {question.hintUses} ({question.hintUseRate}%)</p></div>)}</div><h3 className="mt-5 font-black">Por checkpoint</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{data.checkpoints.map((checkpoint: any) => <div key={checkpoint.checkpointId} className="rounded border p-3 text-sm"><p className="font-bold">{checkpoint.checkpoint}</p><p>Alcanzaron: {checkpoint.reached} · Errores: {checkpoint.wrongAttempts} ({checkpoint.averageWrongAttempts} prom.) · Pistas: {checkpoint.hintUses}</p></div>)}</div><p className="mt-4 text-xs text-neutral-500">{data.semantics?.checkpointReach}</p></div>}</section>}

    {Array.isArray(data.feedback) && <section className="mb-8 rounded bg-white p-4 shadow-sm"><h2 className="font-black">Opiniones de estudiantes</h2>{data.feedback.length === 0 ? <p className="mt-2 text-sm text-neutral-600">No se registraron opiniones durante esta edición.</p> : null}</section>}

    {sessionToInvalidate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><form className="w-full max-w-md rounded bg-white p-5" onSubmit={event => { event.preventDefault(); void handleInvalidate() }}><h2 className="font-black">Invalidar participación</h2><p className="mt-2 text-sm">Solo queda fuera esta participación de esta edición; la identidad puede jugar ediciones futuras.</p><textarea required value={invalidationReason} onChange={event => setInvalidationReason(event.target.value)} className="mt-3 w-full rounded border p-2" placeholder="Motivo" /><div className="mt-3 flex gap-2"><button className="rounded bg-red-700 px-3 py-2 text-white">Confirmar</button><button type="button" onClick={() => setSessionToInvalidate(null)} className="rounded border px-3 py-2">Cancelar</button></div></form></div>}
    {sessionToRelease && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded bg-white p-5"><h2 className="font-black">Rehabilitar participación</h2><div className="mt-3 flex gap-2"><button onClick={() => void handleRelease()} className="rounded bg-neutral-900 px-3 py-2 text-white">Confirmar</button><button onClick={() => setSessionToRelease(null)} className="rounded border px-3 py-2">Cancelar</button></div></div></div>}
    {selectedSessionId !== null && <PlayerDetailDrawer sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />}
  </div></div>
}

function PlayerGroup({ title, players, onDetail }: { title: string; players: any[]; onDetail: (id: number) => void }) {
  return <section className="mb-8"><h2 className="mb-3 text-xl font-black">{title}</h2><div className="grid gap-2 sm:grid-cols-2">{players.map(player => <div key={player.id} className="rounded bg-white p-4"><p className="font-bold">{player.playerName}</p><p className="text-sm text-neutral-500">{player.career || 'Sin carrera'} · Paso {Math.min(player.currentStep, player.totalSteps)} / {player.totalSteps}</p>{player.currentState && <p className="mt-1 text-xs font-bold">{player.currentState}</p>}<button onClick={() => onDetail(player.id)} className="mt-2 rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">Ver detalle</button></div>)}</div></section>
}
