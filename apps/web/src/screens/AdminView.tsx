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
    { id: 'preguntas', label: 'Preguntas' },
    { id: 'rutas', label: 'Rutas' },
    { id: 'qr', label: 'QR' },
  ]

  return (
    <div className="min-h-screen bg-neutral-100 font-sans text-neutral-900 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-neutral-900 text-white p-4">
        <h1 className="text-xl font-bold mb-8 text-orange-500">Admin Control</h1>
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
        {activeTab === 'evento' && <EventSettings initialData={eventData} />}
        {activeTab === 'checkpoints' && <CheckpointsAdmin />}
        {activeTab === 'preguntas' && <ChallengesAdmin />}
        {activeTab === 'rutas' && <RoutesAdmin />}
        {activeTab === 'qr' && <QRAdmin />}
      </main>
    </div>
  )
}

function EventSettings({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await fetch('/api/admin/event', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    setSaving(false)
    alert('Guardado correctamente')
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

      <button onClick={save} disabled={saving} className="bg-orange-600 text-white px-6 py-2 rounded">
        {saving ? 'Guardando...' : 'Guardar Cambios'}
      </button>
    </div>
  )
}

function CheckpointsAdmin() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const res = await fetch('/api/admin/checkpoints')
    setItems(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    const label = prompt('Nombre del checkpoint:')
    if (!label) return
    await fetch('/api/admin/checkpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, is_start: 0, active: 1 })
    })
    load()
  }

  const toggleActive = async (item: any) => {
    await fetch(`/api/admin/checkpoints/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, active: item.active ? 0 : 1 })
    })
    load()
  }

  const regenerateToken = async (id: number) => {
    if (!confirm('¡PELIGRO! Esto invalidará cualquier código QR impreso para este checkpoint. ¿Estás seguro?')) return
    await fetch(`/api/admin/checkpoints/${id}/token`, { method: 'POST' })
    load()
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Checkpoints</h2>
        <button onClick={add} className="bg-green-600 text-white px-4 py-2 rounded">Nuevo Checkpoint</button>
      </div>
      
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-neutral-50">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Preguntas</th>
              <th className="p-3">En Rutas</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t">
                <td className="p-3 text-neutral-500">#{item.id}</td>
                <td className="p-3 font-medium">{item.label}</td>
                <td className="p-3">{item.is_start ? <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">INICIO</span> : 'Normal'}</td>
                <td className="p-3">
                  <button onClick={() => toggleActive(item)} className={`px-2 py-1 rounded text-xs ${item.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {item.active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="p-3 text-center">{item.challengeCount}</td>
                <td className="p-3 text-center">{item.inRoutesCount}</td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => regenerateToken(item.id)} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-100">
                    Regenerar Token
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ChallengesAdmin() {
  const [items, setItems] = useState<any[]>([])
  const [checkpoints, setCheckpoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [resC, resCh] = await Promise.all([
      fetch('/api/admin/checkpoints').then(r => r.json()),
      fetch('/api/admin/challenges').then(r => r.json())
    ])
    setCheckpoints(resC)
    setItems(resCh)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    const cp = prompt('ID del Checkpoint:')
    if (!cp) return
    const qt = prompt('Pregunta:')
    if (!qt) return
    const ans = prompt('Respuesta correcta (y alias separados por coma):')
    if (!ans) return

    await fetch('/api/admin/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        checkpoint_id: parseInt(cp), 
        question_text: qt, 
        accepted_answers: ans.split(',').map(s => s.trim()), 
        hint_text: null, 
        active: 1 
      })
    })
    load()
  }

  const toggleActive = async (item: any) => {
    await fetch(`/api/admin/challenges/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, active: item.active ? 0 : 1 })
    })
    load()
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Preguntas (Challenges)</h2>
        <button onClick={add} className="bg-green-600 text-white px-4 py-2 rounded">Nueva Pregunta</button>
      </div>
      
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-neutral-50">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Checkpoint</th>
              <th className="p-3">Pregunta</th>
              <th className="p-3">Respuestas</th>
              <th className="p-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const cp = checkpoints.find(c => c.id === item.checkpoint_id)
              return (
                <tr key={item.id} className="border-t">
                  <td className="p-3 text-neutral-500">#{item.id}</td>
                  <td className="p-3">{cp?.label || '???'}</td>
                  <td className="p-3 font-medium">{item.question_text}</td>
                  <td className="p-3 text-sm font-mono">{item.accepted_answers.join(' | ')}</td>
                  <td className="p-3">
                    <button onClick={() => toggleActive(item)} className={`px-2 py-1 rounded text-xs ${item.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {item.active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoutesAdmin() {
  const [items, setItems] = useState<any[]>([])
  const [checkpoints, setCheckpoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [resC, resR] = await Promise.all([
      fetch('/api/admin/checkpoints').then(r => r.json()),
      fetch('/api/admin/routes').then(r => r.json())
    ])
    setCheckpoints(resC)
    setItems(resR)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleActive = async (item: any) => {
    await fetch(`/api/admin/routes/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, active: item.active ? 0 : 1 })
    })
    load()
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Rutas</h2>
        <button onClick={() => alert('Para simplificar, usaremos las rutas creadas por seed. Edítalas vía DB o expande este UI.')} className="bg-neutral-300 text-neutral-700 px-4 py-2 rounded">Nueva Ruta</button>
      </div>

      <div className="flex flex-col gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded shadow p-4 border border-neutral-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{item.name}</h3>
              <button onClick={() => toggleActive(item)} className={`px-2 py-1 rounded text-xs ${item.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {item.active ? 'Ruta Activa' : 'Ruta Inactiva'}
              </button>
            </div>
            
            <div className="bg-neutral-50 p-4 rounded text-sm">
              <h4 className="font-bold mb-2">Pasos ({item.steps.length}):</h4>
              <ol className="list-decimal pl-5 flex flex-col gap-2">
                {item.steps.map((s: any) => {
                  const cp = checkpoints.find(c => c.id === s.checkpoint_id)
                  return (
                    <li key={s.id}>
                      <strong>{cp?.label || '???'}</strong> — <em>"{s.clue_text}"</em>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QRAdmin() {
  const [checkpoints, setCheckpoints] = useState<any[]>([])
  const [baseUrl, setBaseUrl] = useState(window.location.origin)
  
  useEffect(() => {
    fetch('/api/admin/checkpoints').then(r => r.json()).then(setCheckpoints)
  }, [])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Generador QR</h2>
      
      <div className="bg-white p-4 rounded shadow mb-6">
        <label className="block text-sm font-bold mb-2">Base URL para los QRs</label>
        <input 
          type="text" 
          className="border rounded p-2 w-full max-w-md" 
          value={baseUrl} 
          onChange={e => setBaseUrl(e.target.value)}
        />
        {(baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) && (
          <p className="text-red-500 text-sm mt-2 font-medium">⚠️ Advertencia: Estás usando localhost. Los teléfonos en la red Wi-Fi no podrán escanear este QR. Usa la IP LAN de tu PC (ej. 192.168.1.50).</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {checkpoints.map(cp => {
          const url = `${baseUrl}/q/${cp.token}`
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&format=svg`
          return (
            <div key={cp.id} className="bg-white rounded shadow p-4 text-center border">
              <h3 className="font-bold mb-1 truncate">{cp.is_start ? '🏁 ' : ''}{cp.label}</h3>
              <p className="text-xs text-neutral-500 truncate mb-4 font-mono">{cp.token}</p>
              <img src={qrUrl} alt={`QR for ${cp.label}`} className="mx-auto w-32 h-32 mb-4" />
              <div className="flex flex-col gap-2">
                <a href={qrUrl} download={`${cp.label.replace(/\s+/g, '-')}.svg`} target="_blank" className="text-sm bg-blue-100 text-blue-700 py-1 rounded block">Ver / Guardar SVG</a>
                <button onClick={() => navigator.clipboard.writeText(url)} className="text-sm bg-neutral-100 text-neutral-700 py-1 rounded">Copiar URL</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
