import React, { useState, useEffect } from 'react'

export function CheckpointsManager() {
  const [checkpoints, setCheckpoints] = useState<any[]>([])
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  const add = async () => {
    const label = prompt('Nombre del nuevo checkpoint:')
    if (!label) return
    await fetch('/api/admin/checkpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, is_start: 0, active: 1 })
    })
    load()
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Checkpoints y Preguntas</h2>
        <button onClick={add} className="bg-green-600 text-white px-4 py-2 rounded font-bold">
          + Nuevo Checkpoint
        </button>
      </div>
      
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
  const [editCPData, setEditCPData] = useState({ label: checkpoint.label, active: checkpoint.active })

  const saveCP = async () => {
    await fetch(`/api/admin/checkpoints/${checkpoint.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...checkpoint, label: editCPData.label, active: editCPData.active ? 1 : 0 })
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
          {editingCP ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <input type="text" className="border px-2 py-1" value={editCPData.label} onChange={e => setEditCPData({...editCPData, label: e.target.value})} />
              <button onClick={saveCP} className="bg-blue-600 text-white px-2 py-1 rounded text-sm">Guardar</button>
              <button onClick={() => {
                setEditingCP(false)
                setEditCPData({ label: checkpoint.label, active: checkpoint.active })
              }} className="text-sm border px-2 py-1 rounded hover:bg-neutral-200">Cancelar</button>
            </div>
          ) : (
            <h3 className="text-lg font-bold">{checkpoint.label}</h3>
          )}
          {checkpoint.is_start === 1 && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">INICIO</span>}
          <span className={`text-xs px-2 py-1 rounded ${checkpoint.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {checkpoint.active ? 'Activo' : 'Inactivo'}
          </span>
          <span className="text-sm text-neutral-500 font-medium">{challenges.length} preguntas</span>
        </div>
        
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => setEditingCP(true)} className="text-sm bg-neutral-200 px-3 py-1 rounded hover:bg-neutral-300 font-medium">Editar</button>
          <button onClick={regenerateQR} className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200 font-medium">Regenerar QR</button>
          <button onClick={toggleActive} className={`text-sm px-3 py-1 rounded text-white font-medium ${checkpoint.active ? 'bg-neutral-500 hover:bg-neutral-600' : 'bg-green-600 hover:bg-green-700'}`}>
            {checkpoint.active ? 'Desactivar' : 'Activar'}
          </button>
          <span className="text-neutral-400 ml-2">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="p-4 border-t border-neutral-200 bg-white">
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
