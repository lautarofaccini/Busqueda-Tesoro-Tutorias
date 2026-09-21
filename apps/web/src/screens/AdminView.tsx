import { useState, useEffect } from 'react'
import { OrganizerView } from './OrganizerView'
import { generateBulkQRPdf, generateSingleQRPdf } from '../lib/pdf'

export function AdminView() {
  const [activeTab, setActiveTab] = useState('resumen')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [totp, setTotp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [eventData, setEventData] = useState<any>(null)

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/event')
      if (res.ok) {
        setIsAuthenticated(true)
        setEventData(await res.json())
      }
    } catch (e) {}
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/organizer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase, totp })
      })
      if (res.ok) {
        await checkAuth()
      } else {
        setError(res.status === 429 ? 'Demasiados intentos. Intentá nuevamente en unos instantes.' : 'No se pudo autenticar.')
      }
    } catch (e) {
      setError('Error de red')
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await fetch('/api/organizer/logout', { method: 'POST' })
    setIsAuthenticated(false)
    setEventData(null)
    setPassphrase('')
    setTotp('')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 font-sans text-neutral-900">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded-lg shadow max-w-sm w-full">
          <h2 className="text-xl font-bold mb-4">Acceso de Administrador</h2>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <label className="block text-sm font-medium mb-1" htmlFor="admin-password">Contraseña</label>
          <input 
            id="admin-password"
            type="password" 
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Contraseña"
            className="w-full border rounded p-2 mb-4"
            required
          />
          <label className="block text-sm font-medium mb-1" htmlFor="admin-totp">Código de autenticación</label>
          <input
            id="admin-totp"
            type="text"
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Código de autenticación"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
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

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'evento', label: 'Evento' },
    { id: 'checkpoints', label: 'Checkpoints' },
    { id: 'asistencia', label: 'Asistencia' },
  ]

  return (
    <div className="min-h-screen bg-neutral-100 font-sans text-neutral-900 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 shrink-0 bg-neutral-900 text-white p-4">
        <h1 className="text-xl font-bold mb-4 text-orange-500">Admin Control</h1>
        <div className="mb-8 px-4 py-2 bg-neutral-800 rounded">
          <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">Estado del Evento</p>
          <p className={`font-bold ${eventData?.status === 'LIVE' ? 'text-green-500' : eventData?.status === 'PAUSED' ? 'text-yellow-500' : eventData?.status === 'ENDED' ? 'text-red-500' : 'text-neutral-300'}`}>
            {eventData?.status || 'DESCONOCIDO'}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 md:flex-col">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-left px-4 py-2 rounded transition-colors ${activeTab === tab.id ? 'bg-orange-600 font-medium' : 'hover:bg-neutral-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <button type="button" onClick={() => void handleLogout()} className="mt-8 w-full rounded border border-neutral-600 px-4 py-2 text-left text-sm hover:bg-neutral-800">Cerrar sesión</button>
      </aside>
      
      <main className="min-w-0 flex-1 p-4 md:p-8 overflow-x-hidden">
        {activeTab === 'resumen' && <OrganizerView isEmbedded />}
        {activeTab === 'evento' && <EventSettings initialData={eventData} onSaved={setEventData} />}
        {activeTab === 'checkpoints' && <CheckpointsAdmin />}
        {activeTab === 'asistencia' && <AssistanceAdmin />}
      </main>
    </div>
  )
}

function AssistanceAdmin() {
  const [data, setData] = useState<any>(null)
  const load = async () => { const response = await fetch('/api/admin/assistance'); if (response.ok) setData(await response.json()) }
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 15_000); return () => window.clearInterval(timer) }, [])
  const resolve = async (url: string, body: any) => { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); await load() }
  if (!data) return <p>Cargando asistencia…</p>
  return <div className="max-w-4xl"><h2 className="text-2xl font-bold">Asistencia <span className="rounded bg-red-600 px-2 py-1 text-sm text-white">{data.pendingCount}</span></h2><p className="mt-1 text-sm text-neutral-500">Actualización automática cada 15 segundos.</p><div className="mt-5 space-y-3">{data.reviews.map((item: any) => <div key={`review-${item.id}`} className="rounded border bg-white p-4"><p className="font-bold">RESPUESTA A REVISAR · {item.display_name}</p><p className="text-sm">{item.label} · {item.created_at} · {item.status}</p><p className="mt-1 break-words text-sm">Respuesta: {item.raw_answer}</p>{item.status === 'PENDING' && <div className="mt-3 flex flex-wrap gap-2"><button className="rounded bg-green-700 px-3 py-2 text-sm text-white" onClick={() => void resolve(`/api/admin/assistance/reviews/${item.id}/resolve`, { approve: true })}>Aprobar</button><button className="rounded border px-3 py-2 text-sm" onClick={() => void resolve(`/api/admin/assistance/reviews/${item.id}/resolve`, { approve: true, addAlias: true })}>Aprobar + alias</button><button className="rounded bg-red-700 px-3 py-2 text-sm text-white" onClick={() => void resolve(`/api/admin/assistance/reviews/${item.id}/resolve`, { approve: false })}>Rechazar</button></div>}</div>)}{data.support.map((item: any) => <div key={`support-${item.id}`} className="rounded border bg-white p-4"><p className="font-bold">{item.category === 'QR_SCAN' || item.category === 'QR_DAMAGED' ? 'QR / CHECKPOINT' : 'OTRO'} · {item.display_name}</p><p className="text-sm">{item.label ?? 'Checkpoint actual'} · {item.created_at} · {item.status}</p>{item.note && <p className="mt-1 break-words text-sm">{item.note}</p>}{item.status === 'PENDING' && <button className="mt-3 rounded border px-3 py-2 text-sm" onClick={() => void resolve(`/api/admin/assistance/support/${item.id}/resolve`, {})}>Resolver</button>}</div>)}</div></div>
}

function EventSettings({ initialData, onSaved }: { initialData: any, onSaved: (data: any) => void }) {
  const [data, setData] = useState(initialData)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [preflightIssues, setPreflightIssues] = useState<any[]>([])

  useEffect(() => setData(initialData), [initialData])

  const save = async () => {
    setSaving(true)
    const response = await fetch('/api/admin/event', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    setSaving(false)
    if (response.ok) {
      onSaved(data)
      setPreflightIssues([])
      setMessage('Cambios guardados.')
    } else {
      const body = await response.json().catch(() => null)
      setPreflightIssues(body?.issues ?? [])
      setMessage(body?.error === 'LIVE_PREFLIGHT_FAILED' ? 'No se puede iniciar el evento hasta completar esta lista.' : 'No se pudieron guardar los cambios.')
    }
  }

  return (
    <div className="max-w-2xl bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Configuración del Evento</h2>
      {preflightIssues.length > 0 && <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900"><p className="font-bold">NO SE PUEDE INICIAR EL EVENTO</p><ul className="mt-2 list-disc pl-5">{preflightIssues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul></div>}
      
      <div className="mb-6 border-b pb-6">
        <label className="block text-sm font-bold mb-2">Estado del Evento</label>
        <select 
          className="border rounded p-2 w-full mb-2"
          value={data.status}
          onChange={e => setData({...data, status: e.target.value})}
        >
          <option value="DRAFT">BORRADOR (DRAFT) - Jugadores bloqueados</option>
          <option value="LIVE">EN VIVO (LIVE) - Juego activo</option>
          <option value="PAUSED">PAUSADO (PAUSED) - Juego detenido temporalmente</option>
          <option value="ENDED">FINALIZADO (ENDED) - Juego terminado</option>
        </select>
        <p className="text-sm text-neutral-500">Cambiar el estado afecta inmediatamente a todos los jugadores.</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-bold mb-2">Nombre del Evento</label>
        <input type="text" className="border rounded p-2 w-full" value={data.event_name} onChange={e => setData({...data, event_name: e.target.value})} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-bold mb-2">Puntos por correcta</label>
          <input type="number" className="border rounded p-2 w-full" value={data.points_per_correct} onChange={e => setData({...data, points_per_correct: parseInt(e.target.value)})} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Penalidad por incorrecta</label>
          <input type="number" className="border rounded p-2 w-full" value={data.wrong_answer_penalty} onChange={e => setData({...data, wrong_answer_penalty: parseInt(e.target.value)})} />
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={save} disabled={saving} className="bg-orange-600 text-white px-6 py-2 rounded">
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>

        <button onClick={() => setConfirmReset(true)}
          className="bg-red-600 text-white px-6 py-2 rounded"
        >
          REINICIAR EVENTO
        </button>
      </div>
      {message && <p className="mt-4 text-sm text-neutral-600" role="status">{message}</p>}
      {confirmReset && <div className="mt-5 border border-red-200 bg-red-50 p-4 rounded">
        <p className="text-sm mb-3">Se eliminarán sesiones, intentos, escaneos, asignaciones y participaciones. El contenido y los QR se conservan.</p>
        <div className="flex gap-3"><button className="bg-red-700 text-white px-4 py-2 rounded" onClick={async () => { const res = await fetch('/api/admin/reset', { method: 'POST' }); if (res.ok) { const next = { ...data, status: 'DRAFT' }; setData(next); onSaved(next); setMessage('Evento reiniciado en BORRADOR.'); setConfirmReset(false) } }}>Confirmar reinicio</button><button className="border px-4 py-2 rounded" onClick={() => setConfirmReset(false)}>Cancelar</button></div>
      </div>}
    </div>
  )
}


export function CheckpointsAdmin() {
  const [checkpoints, setCheckpoints] = useState<any[]>([])
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newCheckpoint, setNewCheckpoint] = useState({ label: '', primary_clue: '' })
  const [expandedCheckpointId, setExpandedCheckpointId] = useState<number | null>(null)

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const [resCp, resCh] = await Promise.all([
      fetch('/api/admin/checkpoints').then(r => r.json()),
      fetch('/api/admin/challenges').then(r => r.json())
    ])
    setCheckpoints(resCp)
    setChallenges(resCh)
    if (showLoading) setLoading(false)
  }

  useEffect(() => { load() }, [])

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    const res = await fetch('/api/admin/checkpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newCheckpoint.label, primary_clue: newCheckpoint.primary_clue, is_start: 0, active: 1 })
    })
    if (res.ok) { setAdding(false); setNewCheckpoint({ label: '', primary_clue: '' }); void load(false) }
  }

  const toggleCheckpoint = (id: number) => {
    setExpandedCheckpointId(current => current === id ? null : id)
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Checkpoints y Preguntas</h2>
        <button onClick={() => generateBulkQRPdf(checkpoints)} className="bg-blue-600 text-white px-4 py-2 rounded font-bold mr-2">
            Preparar Impresión
          </button>
          <button onClick={() => setAdding(true)} className="bg-green-600 text-white px-4 py-2 rounded font-bold">
          + Nuevo Checkpoint
        </button>
      </div>
      {adding && <form onSubmit={add} className="mb-6 bg-white border rounded p-4 flex flex-col gap-3">
        <h3 className="font-bold">Nuevo checkpoint</h3>
        <input required className="border p-2 rounded" placeholder="Nombre" value={newCheckpoint.label} onChange={e => setNewCheckpoint({ ...newCheckpoint, label: e.target.value })} />
        <textarea required className="border p-2 rounded" placeholder="Pista principal" value={newCheckpoint.primary_clue} onChange={e => setNewCheckpoint({ ...newCheckpoint, primary_clue: e.target.value })} />
        <div className="flex gap-2"><button className="bg-green-600 text-white px-3 py-2 rounded" type="submit">Crear</button><button type="button" className="border px-3 py-2 rounded" onClick={() => setAdding(false)}>Cancelar</button></div>
      </form>}
      
      <div className="flex flex-col gap-4 md:gap-6">
        {checkpoints.map(cp => (
          <CheckpointCard key={cp.id} checkpoint={cp} challenges={challenges.filter(c => c.checkpoint_id === cp.id)} expanded={expandedCheckpointId === cp.id} onToggle={() => toggleCheckpoint(cp.id)} reload={load} />
        ))}
      </div>
    </div>
  )
}


function CheckpointCard({ checkpoint, challenges, expanded, onToggle, reload }: { checkpoint: any, challenges: any[], expanded: boolean, onToggle: () => void, reload: () => void }) {
  const [editingCP, setEditingCP] = useState(false)
  const [editCPData, setEditCPData] = useState({
    label: checkpoint.label,
    active: checkpoint.active,
    instruction: checkpoint.instruction || '',
    primary_clue: checkpoint.primary_clue || '',
    secondary_clue: checkpoint.secondary_clue || ''
  })

  const saveCP = async () => {
    await fetch(`/api/admin/checkpoints/${checkpoint.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...checkpoint,
        label: editCPData.label,
        active: editCPData.active ? 1 : 0,
        instruction: editCPData.instruction,
        primary_clue: editCPData.primary_clue,
        secondary_clue: editCPData.secondary_clue
      })
    })
    setEditingCP(false)
    void reload()
  }

  const toggleActive = async () => {
    await fetch(`/api/admin/checkpoints/${checkpoint.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...checkpoint, active: checkpoint.active ? 0 : 1 })
    })
    void reload()
  }

  const regenerateQR = async () => {
    if (window.confirm("¡PELIGRO! Esto invalidará los QRs impresos. ¿Continuar?")) {
      await fetch(`/api/admin/checkpoints/${checkpoint.id}/token`, { method: 'POST' })
      reload()
    }
  }

  const qrTargetUrl = `https://tesoro.tutorias-frre.workers.dev/q/${checkpoint.token}`
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(qrTargetUrl)}&format=svg`
  const [showQr, setShowQr] = useState(false)

  return (
    <div className="bg-white border rounded shadow-sm overflow-hidden">
      <div className="p-4 flex items-center justify-between bg-neutral-50 cursor-pointer hover:bg-neutral-100 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-neutral-500">#{checkpoint.id}</span>
          <h3 className="text-lg font-bold">{checkpoint.label}</h3>
          {checkpoint.is_start === 1 && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">INICIO</span>}
          <span className={`text-xs px-2 py-1 rounded ${checkpoint.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {checkpoint.active ? 'Activo' : 'Inactivo'}
          </span>
          <span className="text-sm text-neutral-500 font-medium">{challenges.length} preguntas</span>
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => setShowQr(true)} className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 font-medium">Ver QR</button>
          <button onClick={event => { event.stopPropagation(); generateSingleQRPdf(checkpoint); }} className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 font-medium">Descargar QR</button>
          <button onClick={regenerateQR} className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 font-medium">Regenerar QR</button>
          <button onClick={toggleActive} className={`text-sm px-3 py-1 rounded text-white font-medium ${checkpoint.active ? 'bg-neutral-500 hover:bg-neutral-600' : 'bg-green-600 hover:bg-green-700'}`}>
            {checkpoint.active ? 'Desactivar' : 'Activar'}
          </button>
          <button type="button" onClick={event => { event.stopPropagation(); onToggle() }} aria-label={`${expanded ? 'Cerrar' : 'Abrir'} checkpoint ${checkpoint.label}`} aria-expanded={expanded} className="ml-1 rounded p-2 text-neutral-600 hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d={expanded ? 'm5 12 5-5 5 5' : 'm5 8 5 5 5-5'} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 border-t border-neutral-200 bg-white flex flex-col gap-6">
          {/* Detalles del Checkpoint */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-neutral-700">Detalles y Pistas</h4>
              {!editingCP && (
                <button onClick={() => setEditingCP(true)} className="text-sm bg-neutral-200 px-3 py-1 rounded hover:bg-neutral-300 font-medium">Editar Detalles</button>
              )}
            </div>
            {editingCP ? (
              <div className="flex flex-col gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-600 mb-1">Nombre</label>
                  <input className="w-full border p-2 rounded" value={editCPData.label} onChange={e => setEditCPData({...editCPData, label: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-600 mb-1">Instrucción Adicional (Opcional - p.ej. Reglas del lugar)</label>
                  <input className="w-full border p-2 rounded" value={editCPData.instruction} onChange={e => setEditCPData({...editCPData, instruction: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-600 mb-1">Pista Principal</label>
                  <textarea className="w-full border p-2 rounded" value={editCPData.primary_clue} onChange={e => setEditCPData({...editCPData, primary_clue: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-600 mb-1">Pista Secundaria (Opcional - Ayuda extra)</label>
                  <textarea className="w-full border p-2 rounded" value={editCPData.secondary_clue} onChange={e => setEditCPData({...editCPData, secondary_clue: e.target.value})} />
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={saveCP} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold">Guardar Detalles</button>
                  <button onClick={() => {
                    setEditingCP(false)
                    setEditCPData({ label: checkpoint.label, active: checkpoint.active, instruction: checkpoint.instruction || '', primary_clue: checkpoint.primary_clue || '', secondary_clue: checkpoint.secondary_clue || '' })
                  }} className="px-4 py-2 text-sm border rounded bg-white font-bold text-neutral-600">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-4 bg-neutral-50 border border-neutral-200 rounded">
                <div>
                  <span className="block text-xs font-bold uppercase text-neutral-500">Instrucción Adicional</span>
                  <p className="text-sm">{checkpoint.instruction || <span className="text-neutral-400 italic">Ninguna</span>}</p>
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase text-neutral-500">Pista Principal</span>
                  <p className="text-sm font-medium">{checkpoint.primary_clue || <span className="text-red-400 italic">¡Falta pista principal!</span>}</p>
                </div>
                <div>
                  <span className="block text-xs font-bold uppercase text-neutral-500">Pista Secundaria</span>
                  <p className="text-sm">{checkpoint.secondary_clue || <span className="text-neutral-400 italic">Ninguna</span>}</p>
                </div>
              </div>
            )}
          </div>

          <hr className="border-neutral-200" />

          {/* Preguntas */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-neutral-700">Preguntas del Checkpoint</h4>
              <AddChallengeModal checkpointId={checkpoint.id} reload={reload} />
            </div>
            {challenges.length === 0 ? (
              <p className="text-sm text-neutral-500 italic p-4 bg-neutral-50 rounded border border-dashed text-center">No hay preguntas en este checkpoint.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {challenges.map(ch => (
                  <ChallengeRow key={ch.id} challenge={ch} reload={reload} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {showQr && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`QR de ${checkpoint.label}`} onClick={() => setShowQr(false)}>
        <div className="w-full max-w-sm rounded-lg bg-white p-5 text-center shadow-xl" onClick={event => event.stopPropagation()}>
          <p className="text-sm font-bold uppercase tracking-wider text-brand">Búsqueda del Tesoro</p>
          <h4 className="mt-1 text-lg font-bold">{checkpoint.is_start ? 'INICIO · ' : ''}{checkpoint.label}</h4>
          <p className="mt-1 text-sm text-neutral-500">Escaneá acá</p>
          <p className="mt-3 rounded bg-amber-50 p-3 text-sm font-bold text-amber-900">¿No podés escanear? Código: {checkpoint.fallback_code || 'Pendiente de migración'}</p>
          <img src={qrImageUrl} alt={`Código QR de ${checkpoint.label}`} className="mx-auto my-5 h-64 w-64" />
          <p className="break-all text-xs text-neutral-500">{qrTargetUrl}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3"><button onClick={() => generateSingleQRPdf(checkpoint)} className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white">Descargar QR</button><button type="button" onClick={() => setShowQr(false)} className="rounded border px-4 py-2 text-sm font-bold">Cerrar</button></div>
        </div>
      </div>}
    </div>
  )
}


function ChallengeRow({ challenge, reload }: { challenge: any, reload: () => void }) {
  const [editing, setEditing] = useState(false)
  const [data, setData] = useState({
    question_text: challenge.question_text,
    accepted_answers: challenge.accepted_answers.join(', '),
    hint_text: challenge.hint_text ?? '',
    active: challenge.active,
    needs_review: challenge.needs_review ?? 0,
    review_note: challenge.review_note ?? ''
  })

  const save = async () => {
    await fetch(`/api/admin/challenges/${challenge.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...challenge,
        question_text: data.question_text,
        accepted_answers: data.accepted_answers.split(',').map((s:string) => s.trim()).filter(Boolean),
        hint_text: data.hint_text || null,
        active: data.active ? 1 : 0,
        needs_review: data.needs_review ? 1 : 0,
        review_note: data.review_note || null
      })
    })
    setEditing(false)
    reload()
  }

  const toggle = async () => {
    await fetch(`/api/admin/challenges/${challenge.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...challenge, active: challenge.active ? 0 : 1 })
    })
    reload()
  }

  if (editing) {
    return (
      <div className="p-4 border rounded bg-yellow-50 flex flex-col gap-3 border-yellow-200 shadow-sm">
        <label className="font-bold text-xs text-neutral-600 uppercase">Pregunta</label>
        <input className="border p-2 w-full rounded" value={data.question_text} onChange={e => setData({...data, question_text: e.target.value})} />
        <label className="font-bold text-xs text-neutral-600 uppercase mt-2">Respuestas Aceptadas (separadas por coma)</label>
        <input className="border p-2 w-full rounded" value={data.accepted_answers} onChange={e => setData({...data, accepted_answers: e.target.value})} />
        <label className="font-bold text-xs text-neutral-600 uppercase mt-2">Pista (opcional)</label>
        <input className="border p-2 w-full rounded" value={data.hint_text} onChange={e => setData({...data, hint_text: e.target.value})} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!data.needs_review} onChange={e => setData({...data, needs_review: e.target.checked ? 1 : 0})} /> Requiere revisión</label>
        {data.needs_review && <input className="border p-2 w-full rounded" value={data.review_note} onChange={e => setData({...data, review_note: e.target.value})} placeholder="Nota de revisión" />}
        <div className="flex gap-2 mt-2">
          <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold">Guardar</button>
          <button onClick={() => {
            setEditing(false)
            setData({
              question_text: challenge.question_text,
              accepted_answers: challenge.accepted_answers.join(', '),
              hint_text: challenge.hint_text ?? '',
              active: challenge.active, needs_review: challenge.needs_review ?? 0, review_note: challenge.review_note ?? ''
            })
          }} className="px-4 py-2 text-sm border rounded bg-white hover:bg-neutral-100 font-bold text-neutral-600">Cancelar</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex justify-between items-center p-4 border rounded shadow-sm ${challenge.active ? 'bg-white' : 'bg-neutral-50 opacity-75'}`}>
      <div className="flex-1">
        <p className="font-bold text-neutral-800 mb-1">{challenge.question_text}</p>
        {challenge.needs_review ? <><span className="inline-block bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-bold">REVISAR</span><p className="text-xs text-amber-800 mt-1">{challenge.review_note}</p></> : null}
        <div className="flex flex-wrap gap-1">
          {challenge.accepted_answers.map((ans: string, i: number) => (
            <span key={i} className="bg-neutral-100 text-neutral-600 text-xs px-2 py-1 rounded border font-mono">
              {ans}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <span className={`text-xs px-2 py-1 rounded font-bold ${challenge.active ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-700'}`}>
          {challenge.active ? 'Activa' : 'Inactiva'}
        </span>
        <button onClick={() => setEditing(true)} className="text-sm bg-neutral-100 border px-3 py-1 rounded hover:bg-neutral-200 font-medium">Editar</button>
        <button onClick={toggle} className={`text-sm px-3 py-1 rounded text-white font-medium ${challenge.active ? 'bg-neutral-400 hover:bg-neutral-500' : 'bg-green-600 hover:bg-green-700'}`}>
          {challenge.active ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
  )
}

function AddChallengeModal({ checkpointId, reload }: { checkpointId: number, reload: () => void }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ q: '', a: '' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/admin/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkpoint_id: checkpointId,
        question_text: data.q,
        accepted_answers: data.a.split(',').map(s => s.trim()).filter(Boolean),
        hint_text: null,
        active: 1,
        needs_review: 0,
        review_note: null
      })
    })
    setOpen(false)
    setData({ q: '', a: '' })
    reload()
  }

  if (!open) return <button onClick={() => setOpen(true)} className="bg-green-600 text-white px-3 py-2 rounded text-sm font-bold shadow-sm">+ Añadir Pregunta</button>

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md flex flex-col gap-4">
        <h3 className="font-bold text-xl text-neutral-800 mb-2">Nueva Pregunta</h3>
        
        <div>
          <label className="block text-sm font-bold text-neutral-600 mb-1 uppercase">Pregunta</label>
          <input required className="border p-2 w-full rounded focus:ring-2 focus:ring-orange-500 outline-none" placeholder="¿Cuál es la capital de...?" value={data.q} onChange={e => setData({...data, q: e.target.value})} />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-neutral-600 mb-1 uppercase">Respuestas Correctas</label>
          <input required className="border p-2 w-full rounded focus:ring-2 focus:ring-orange-500 outline-none" placeholder="separadas, por, coma" value={data.a} onChange={e => setData({...data, a: e.target.value})} />
          <p className="text-xs text-neutral-500 mt-1">El jugador puede escribir cualquiera de estas para avanzar.</p>
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 hover:bg-neutral-100 rounded font-bold text-neutral-600">Cancelar</button>
          <button type="submit" className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold">Añadir Pregunta</button>
        </div>
      </form>
    </div>
  )
}
