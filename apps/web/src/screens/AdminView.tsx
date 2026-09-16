import { useState, useEffect } from 'react'
import { OrganizerView } from './OrganizerView'

export function AdminView() {
  const [activeTab, setActiveTab] = useState('resumen')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passphrase, setPassphrase] = useState('')
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
        body: JSON.stringify({ passphrase })
      })
      if (res.ok) {
        await checkAuth()
      } else {
        setError('Acceso denegado (Contraseña incorrecta)')
      }
    } catch (e) {
      setError('Error de red')
    }
    setLoading(false)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 font-sans text-neutral-900">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded-lg shadow max-w-sm w-full">
          <h2 className="text-xl font-bold mb-4">Acceso de Administrador</h2>
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

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'evento', label: 'Evento' },
    { id: 'checkpoints', label: 'Checkpoints' },
  ]

  return (
    <div className="min-h-screen bg-neutral-100 font-sans text-neutral-900 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-neutral-900 text-white p-4">
        <h1 className="text-xl font-bold mb-4 text-orange-500">Admin Control</h1>
        <div className="mb-8 px-4 py-2 bg-neutral-800 rounded">
          <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">Estado del Evento</p>
          <p className={`font-bold ${eventData?.status === 'LIVE' ? 'text-green-500' : eventData?.status === 'PAUSED' ? 'text-yellow-500' : eventData?.status === 'ENDED' ? 'text-red-500' : 'text-neutral-300'}`}>
            {eventData?.status || 'DESCONOCIDO'}
          </p>
        </div>
        <nav className="flex flex-col gap-2">
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
      </aside>
      
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {activeTab === 'resumen' && <OrganizerView isEmbedded />}
        {activeTab === 'evento' && <EventSettings initialData={eventData} onSaved={setEventData} />}
        {activeTab === 'checkpoints' && <CheckpointsAdmin />}
      </main>
    </div>
  )
}

function EventSettings({ initialData, onSaved }: { initialData: any, onSaved: (data: any) => void }) {
  const [data, setData] = useState(initialData)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

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
      setMessage('Cambios guardados.')
    } else setMessage('No se pudieron guardar los cambios.')
  }

  return (
    <div className="max-w-2xl bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Configuración del Evento</h2>
      
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


function CheckpointsAdmin() {
  const [checkpoints, setCheckpoints] = useState<any[]>([])
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newCheckpoint, setNewCheckpoint] = useState({ label: '', primary_clue: '' })

  const load = async () => {
    setLoading(true)
    const [resCp, resCh] = await Promise.all([
      fetch('/api/admin/checkpoints').then(r => r.json()),
      fetch('/api/admin/challenges').then(r => r.json())
    ])
    setCheckpoints(resCp)
    setChallenges(resCh)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    const res = await fetch('/api/admin/checkpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newCheckpoint.label, primary_clue: newCheckpoint.primary_clue, is_start: 0, active: 1 })
    })
    if (res.ok) { setAdding(false); setNewCheckpoint({ label: '', primary_clue: '' }); load() }
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Checkpoints y Preguntas</h2>
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
      
      <div className="flex flex-col gap-6">
        {checkpoints.map(cp => (
          <CheckpointCard key={cp.id} checkpoint={cp} challenges={challenges.filter(c => c.checkpoint_id === cp.id)} reload={load} />
        ))}
      </div>
    </div>
  )
}


function CheckpointCard({ checkpoint, challenges, reload }: { checkpoint: any, challenges: any[], reload: () => void }) {
  const [expanded, setExpanded] = useState(false)
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
    reload()
  }

  const toggleActive = async () => {
    await fetch(`/api/admin/checkpoints/${checkpoint.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...checkpoint, active: checkpoint.active ? 0 : 1 })
    })
    reload()
  }

  const regenerateQR = async () => {
    if (window.confirm("¡PELIGRO! Esto invalidará los QRs impresos. ¿Continuar?")) {
      await fetch(`/api/admin/checkpoints/${checkpoint.id}/token`, { method: 'POST' })
      reload()
    }
  }

  return (
    <div className="bg-white border rounded shadow-sm overflow-hidden">
      <div className="p-4 flex items-center justify-between bg-neutral-50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-neutral-500">#{checkpoint.id}</span>
          <h3 className="text-lg font-bold">{checkpoint.label}</h3>
          {checkpoint.is_start === 1 && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">INICIO</span>}
          <span className={`text-xs px-2 py-1 rounded ${checkpoint.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {checkpoint.active ? 'Activo' : 'Inactivo'}
          </span>
          <span className="text-sm text-neutral-500 font-medium">{challenges.length} preguntas</span>
        </div>
        
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={regenerateQR} className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 font-medium">Regenerar QR</button>
          <button onClick={toggleActive} className={`text-sm px-3 py-1 rounded text-white font-medium ${checkpoint.active ? 'bg-neutral-500 hover:bg-neutral-600' : 'bg-green-600 hover:bg-green-700'}`}>
            {checkpoint.active ? 'Desactivar' : 'Activar'}
          </button>
          <span className="text-neutral-400 ml-2">{expanded ? '▲' : '▼'}</span>
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
    </div>
  )
}


function ChallengeRow({ challenge, reload }: { challenge: any, reload: () => void }) {
  const [editing, setEditing] = useState(false)
  const [data, setData] = useState({
    question_text: challenge.question_text,
    accepted_answers: challenge.accepted_answers.join(', '),
    active: challenge.active
  })

  const save = async () => {
    await fetch(`/api/admin/challenges/${challenge.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...challenge,
        question_text: data.question_text,
        accepted_answers: data.accepted_answers.split(',').map((s:string) => s.trim()).filter(Boolean),
        active: data.active ? 1 : 0
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
        <div className="flex gap-2 mt-2">
          <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold">Guardar</button>
          <button onClick={() => {
            setEditing(false)
            setData({
              question_text: challenge.question_text,
              accepted_answers: challenge.accepted_answers.join(', '),
              active: challenge.active
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
        active: 1
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
