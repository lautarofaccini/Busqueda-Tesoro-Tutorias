import { useEffect, useState } from 'react'
import { AssistancePanel } from '../components/AssistancePanel'

export function AssistanceView() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { void fetch('/api/assistance/feed').then(response => setAuthenticated(response.ok)).finally(() => setChecking(false)) }, [])
  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/assistance/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      if (response.ok) setAuthenticated(true)
      else setError(response.status === 429 ? 'Demasiados intentos. Intentá nuevamente en unos instantes.' : 'No se pudo autenticar.')
    } catch { setError('No se pudo autenticar.') }
    finally { setLoading(false) }
  }
  const logout = async () => { await fetch('/api/assistance/logout', { method: 'POST' }); setAuthenticated(false); setPassword('') }

  if (checking) return <main className="min-h-dvh bg-neutral-100 p-6">Cargando…</main>
  if (!authenticated) return <main className="flex min-h-dvh items-center justify-center bg-neutral-100 p-4"><form onSubmit={login} className="w-full max-w-sm rounded-xl bg-white p-6 shadow"><h1 className="text-2xl font-black">Asistencia Tutorías</h1>{error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}<label className="mt-5 block text-sm font-bold" htmlFor="assistance-user">Usuario</label><input id="assistance-user" className="mt-1 w-full rounded border p-3" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required /><label className="mt-4 block text-sm font-bold" htmlFor="assistance-password">Contraseña</label><input id="assistance-password" type="password" className="mt-1 w-full rounded border p-3" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /><button disabled={loading} className="mt-5 w-full rounded bg-orange-600 p-3 font-bold text-white disabled:opacity-50">{loading ? 'Ingresando…' : 'Entrar'}</button></form></main>
  return <main className="min-h-dvh overflow-x-hidden bg-neutral-100 p-3 text-neutral-900 sm:p-5"><header className="mx-auto mb-4 flex max-w-4xl items-center justify-between"><p className="font-black text-orange-700">Tutorías · Asistencia</p><button className="rounded border bg-white px-3 py-2 text-sm font-bold" onClick={() => void logout()}>Cerrar sesión</button></header><AssistancePanel basePath="/api/assistance" /></main>
}
