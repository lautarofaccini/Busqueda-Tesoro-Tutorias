import { useState, useEffect } from 'react'

export function OrganizerView() {
  const [passphrase, setPassphrase] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/organizer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase })
      })
      if (res.ok) {
        await fetchResults()
      } else {
        setError('Acceso denegado (Contraseña incorrecta)')
      }
    } catch (e) {
      setError('Network error')
    }
    setLoading(false)
  }

  if (loading && !data) return <div className="p-4">Cargando...</div>

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 font-sans text-neutral-900">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded-lg shadow max-w-sm w-full">
          <h2 className="text-xl font-bold mb-4">Acceso de Organizador</h2>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <input 
            type="password" 
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Contraseña"
            className="w-full border rounded p-2 mb-4"
            required
          />
          <button type="submit" className="w-full bg-orange-600 text-white p-2 rounded" disabled={loading}>
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 sm:p-8 font-sans text-neutral-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Resultados de Búsqueda del Tesoro</h1>
          <button onClick={fetchResults} className="bg-neutral-200 px-4 py-2 rounded text-sm hover:bg-neutral-300">
            Actualizar
          </button>
        </div>

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
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="p-3 font-semibold">Pos</th>
                <th className="p-3 font-semibold">Equipo/Jugador</th>
                <th className="p-3 font-semibold text-right">Puntaje</th>
                <th className="p-3 font-semibold text-right">Errores</th>
                <th className="p-3 font-semibold text-right">Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {data?.ranking.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-neutral-500">Nadie ha terminado aún</td></tr>
              ) : (
                data?.ranking.map((p: any) => (
                  <tr key={p.id} className="border-b border-neutral-100">
                    <td className="p-3 font-bold text-neutral-500">{p.rank}</td>
                    <td className="p-3 font-medium">
                      {p.playerName}
                      {p.needsReview && <span className="ml-2 inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">Rápido</span>}
                    </td>
                    <td className="p-3 text-right font-bold text-orange-600">{p.score}</td>
                    <td className="p-3 text-right text-red-500">{p.wrongCount}</td>
                    <td className="p-3 text-right text-neutral-500 font-mono text-sm">{Math.floor(p.durationSec / 60)}m {p.durationSec % 60}s</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-bold mb-4">En Juego (Activos)</h2>
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="p-3 font-semibold">Equipo/Jugador</th>
                <th className="p-3 font-semibold text-center">Progreso</th>
                <th className="p-3 font-semibold text-right">Errores</th>
                <th className="p-3 font-semibold text-right">Inicio</th>
              </tr>
            </thead>
            <tbody>
              {data?.active.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-neutral-500">No hay sesiones activas</td></tr>
              ) : (
                data?.active.map((p: any) => (
                  <tr key={p.id} className="border-b border-neutral-100">
                    <td className="p-3 font-medium">{p.playerName}</td>
                    <td className="p-3 text-center">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">Paso {Math.min(p.currentStep, p.totalSteps)} / {p.totalSteps}</span>
                    </td>
                    <td className="p-3 text-right text-red-500">{p.wrongCount}</td>
                    <td className="p-3 text-right text-neutral-500 text-sm">{new Date(p.startedAt).toLocaleTimeString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
