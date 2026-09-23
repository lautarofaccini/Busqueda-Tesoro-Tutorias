import { useState, useEffect } from 'react'
import { PlayerDetailDrawer } from '../components/PlayerDetailDrawer'
import { elapsedSeconds, formatElapsed, formatEventTime } from '../lib/eventTime'

export function OrganizerView({ isEmbedded }: { isEmbedded?: boolean } = {}) {
  const [passphrase, setPassphrase] = useState('')
  const [totp, setTotp] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [participantToInvalidate, setParticipantToInvalidate] = useState<number | null>(null)
  const [invalidationReason, setInvalidationReason] = useState('')
  const [participantToRelease, setParticipantToRelease] = useState<number | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  const fetchResults = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/organizer/results')
      if (res.status === 401) {
        setIsAuthenticated(false)
      } else if (res.ok) {
        setIsAuthenticated(true)
        setData(await res.json())
      } else {
        setError('Error fetching results')
      }
    } catch (e) {
      setError('Network error')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchResults()
  }, [])

  useEffect(() => {
    if (!data?.active?.length) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [data?.active?.length])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/organizer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase, totp })
      })
      if (res.ok) {
        await fetchResults()
      } else {
        setError(res.status === 429 ? 'Demasiados intentos. Intentá nuevamente en unos instantes.' : 'No se pudo autenticar.')
      }
    } catch (e) {
      setError('Network error')
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await fetch('/api/organizer/logout', { method: 'POST' })
    setIsAuthenticated(false)
    setData(null)
    setPassphrase('')
    setTotp('')
  }


  const handleInvalidar = async () => {
    if (!participantToInvalidate || !invalidationReason.trim()) return
    await fetch(`/api/admin/participants/${participantToInvalidate}/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: invalidationReason.trim() })
    })
    setParticipantToInvalidate(null)
    setInvalidationReason('')
    fetchResults()
  }

  const handleRehabilitar = async () => {
    if (!participantToRelease) return
    await fetch(`/api/admin/participants/${participantToRelease}/release`, {
      method: 'POST'
    })
    setParticipantToRelease(null)
    fetchResults()
  }

  if (!isAuthenticated && !isEmbedded) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 font-sans text-neutral-900">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded-lg shadow max-w-sm w-full">
          <h2 className="text-xl font-bold mb-4">Acceso de organizador</h2>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <label className="block text-sm font-medium mb-1" htmlFor="organizer-password">Contraseña</label>
          <input 
            id="organizer-password"
            type="password" 
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Contraseña"
            className="w-full border rounded p-2 mb-4"
            required
          />
          <label className="block text-sm font-medium mb-1" htmlFor="organizer-totp">Código de autenticación</label>
          <input id="organizer-totp" type="text" value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Código de autenticación" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} className="w-full border rounded p-2 mb-4" required />
          <button type="submit" className="w-full bg-orange-600 text-white p-2 rounded" disabled={loading}>
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    )
  }

  if (loading && !data) {
    return <div className="p-4">Loading results...</div>
  }

  if (!data) {
    return <div className="p-4">No data available.</div>
  }

  const Wrapper = isEmbedded ? 'div' : 'div'
  const wrapperClass = isEmbedded ? '' : 'min-h-screen bg-neutral-100 p-4 font-sans text-neutral-900'

  return (
    <div className={wrapperClass}>
      <div className="max-w-6xl mx-auto">
        {!isEmbedded && (
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Resumen del Evento</h1>
            <button onClick={fetchResults} className="bg-white border rounded px-3 py-1 shadow-sm text-sm hover:bg-neutral-50">
              Actualizar
            </button>
            <button onClick={() => void handleLogout()} className="border rounded px-3 py-1 text-sm hover:bg-neutral-50">Cerrar sesión</button>
          </div>
        )}
        
        {isEmbedded && (
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Resumen de Resultados</h1>
            <button onClick={fetchResults} className="bg-white border rounded px-3 py-1 shadow-sm text-sm hover:bg-neutral-50">
              Actualizar
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded shadow text-center">
            <div className="text-3xl font-bold text-orange-600">{data?.totals.all}</div>
            <div className="text-sm text-neutral-500 uppercase">Totales</div>
          </div>
          <div className="bg-white p-4 rounded shadow text-center">
            <div className="text-3xl font-bold text-blue-600">{data?.totals.active}</div>
            <div className="text-sm text-neutral-500 uppercase">En Juego</div>
          </div>
          <div className="bg-white p-4 rounded shadow text-center">
            <div className="text-3xl font-bold text-green-600">{data?.totals.completed}</div>
            <div className="text-sm text-neutral-500 uppercase">Completados</div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Ranking (Completados)</h2>
        <div className="bg-white rounded shadow overflow-x-auto mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              
              <tr className="bg-neutral-50 border-b border-neutral-200 text-xs text-neutral-600 uppercase">
                <th className="p-3 font-bold">Pos</th>
                <th className="p-3 font-bold">Jugador / Equipo</th>
                <th className="p-3 font-bold">Identificación</th>
                <th className="p-3 font-bold text-right">Puntaje</th>
                <th className="p-3 font-bold text-right">Errores</th>
                <th className="p-3 font-bold text-right">Pistas</th>
                <th className="p-3 font-bold text-right">Tiempo</th>
                <th className="p-3 font-bold text-right">Acciones</th>
              </tr>

            </thead>
            <tbody>
              {data?.ranking.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-neutral-500">Nadie ha terminado aún</td></tr>
              ) : (
                
                data?.ranking.map((p: any) => (
                  <tr key={p.id} className={`border-b border-neutral-100 ${p.invalidatedAt ? 'bg-red-50 opacity-75' : ''}`}>
                    <td className="p-3 font-bold text-neutral-500">
                      {p.invalidatedAt ? (
                        <span className="text-red-500 text-xs">ANULADO</span>
                      ) : p.isTied ? (
                        <span className="text-blue-500 text-xs">#{p.rank} · EMPATE</span>
                      ) : (
                        `#${p.rank}`
                      )}
                    </td>
                    <td className="p-3 font-medium">
                      {p.playerName}
                      {p.needsReview && !p.invalidatedAt && <span className="ml-2 inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded font-bold">Rápido</span>}
                      {p.invalidatedAt && <div className="text-xs text-red-600 mt-1">Motivo: {p.invalidationReason}</div>}
                    </td>
                    <td className="p-3 font-mono text-sm text-neutral-600">
                      {p.identifierType} {p.identifierSuffix}
                    </td>
                    <td className="p-3 text-right font-bold text-orange-600">{p.score}</td>
                    <td className="p-3 text-right text-red-500">{p.wrongCount}</td>
                    <td className="p-3 text-right">{p.hintsUsed}</td>
                    <td className="p-3 text-right text-neutral-500 font-mono text-sm whitespace-nowrap">FINALIZADO · {formatElapsed(p.durationSec)} total</td>
                    <td className="p-3 text-right">
                      <button onClick={() => setSelectedSessionId(p.id)} className="mr-2 text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 px-2 py-1 rounded">Ver detalle</button>
                      {p.invalidatedAt ? (
                        <button onClick={() => setParticipantToRelease(p.participantId)} className="text-xs bg-neutral-200 hover:bg-neutral-300 px-2 py-1 rounded">Rehabilitar</button>
                      ) : (
                        <button onClick={() => setParticipantToInvalidate(p.participantId)} className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded">Invalidar</button>
                      )}
                    </td>
                  </tr>
                ))

              )}
            </tbody>
          </table>
        </div>

        {data.invalidated?.length > 0 && <div className="bg-white rounded shadow p-4 mt-8"><h2 className="font-bold mb-3">Participaciones invalidadas</h2>{data.invalidated.map((p: any) => <div key={p.id} className="flex justify-between border-t py-2 text-sm"><span>{p.playerName} — {p.identifierType} {p.identifierSuffix}</span><button onClick={() => setParticipantToRelease(p.participantId)} className="border px-2 py-1 rounded">Rehabilitar identificación</button></div>)}</div>}
        {participantToInvalidate && <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"><form className="bg-white p-5 rounded w-full max-w-md" onSubmit={(e) => { e.preventDefault(); void handleInvalidar() }}><h2 className="font-bold">Invalidar participación</h2><p className="text-sm mt-2">Queda fuera del ranking y se conserva el historial.</p><textarea required className="w-full border rounded p-2 mt-3" value={invalidationReason} onChange={e => setInvalidationReason(e.target.value)} placeholder="Motivo de invalidación" /><div className="flex gap-2 mt-3"><button className="bg-red-700 text-white px-3 py-2 rounded">Confirmar</button><button type="button" className="border px-3 py-2 rounded" onClick={() => setParticipantToInvalidate(null)}>Cancelar</button></div></form></div>}
        {participantToRelease && <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"><div className="bg-white p-5 rounded w-full max-w-md"><h2 className="font-bold">Rehabilitar identificación</h2><p className="text-sm mt-2">La identificación podrá registrarse nuevamente.</p><div className="flex gap-2 mt-3"><button className="bg-neutral-800 text-white px-3 py-2 rounded" onClick={() => void handleRehabilitar()}>Confirmar</button><button className="border px-3 py-2 rounded" onClick={() => setParticipantToRelease(null)}>Cancelar</button></div></div></div>}

        <h2 className="text-xl font-bold mb-4">En Juego (Activos)</h2>
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="p-3 font-semibold">Equipo/Jugador</th>
                <th className="p-3 font-semibold text-center">Progreso</th>
                <th className="p-3 font-semibold">Estado</th>
                <th className="p-3 font-semibold text-right">Errores</th>
                <th className="p-3 font-semibold text-right">Inicio</th>
                <th className="p-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {data?.active.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-neutral-500">No hay sesiones activas</td></tr>
              ) : (
                data?.active.map((p: any) => (
                  <tr key={p.id} className="border-b border-neutral-100">
                    <td className="p-3 font-medium">{p.playerName}</td>
                    <td className="p-3 text-center">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">Paso {Math.min(p.currentStep, p.totalSteps)} / {p.totalSteps}</span>
                    </td>
                    <td className="p-3 text-xs font-bold whitespace-nowrap">
                      {p.currentState} · <span className="font-mono">{formatElapsed(elapsedSeconds(p.stateSince, now))}</span>
                      {p.pendingReview && <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-amber-950">REVISIÓN</span>}
                    </td>
                    <td className="p-3 text-right text-red-500">{p.wrongCount}</td>
                    <td className="p-3 text-right text-neutral-500 text-sm whitespace-nowrap">{formatEventTime(p.startedAt)}</td>
                    <td className="p-3 text-right"><button type="button" className="rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800 hover:bg-blue-200" onClick={() => setSelectedSessionId(p.id)}>Ver detalle</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {selectedSessionId !== null && <PlayerDetailDrawer sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />}
      </div>
    </div>
  )
}
