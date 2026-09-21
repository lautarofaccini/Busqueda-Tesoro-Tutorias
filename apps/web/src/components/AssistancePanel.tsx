import { useCallback, useEffect, useRef, useState } from 'react'

type FeedItem = {
  id: number
  kind: 'ANSWER_REVIEW' | 'SUPPORT'
  actionable: boolean
  status: string
  created_at: string
  display_name: string
  label?: string | null
  category?: string
  note?: string | null
  question_text?: string
  raw_answer?: string
  canonical_answer?: string
  accepted_aliases?: string[]
  score_at_request?: number
  session_id: number
}

type Feed = { pendingCount: number; items: FeedItem[] }

export function AssistancePanel({ basePath, allowAlias = false }: { basePath: '/api/admin/assistance' | '/api/assistance'; allowAlias?: boolean }) {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [message, setMessage] = useState('')
  const [newCount, setNewCount] = useState(0)
  const [busyKey, setBusyKey] = useState('')
  const loading = useRef(false)
  const knownActionableIds = useRef(new Set<string>())
  const initialized = useRef(false)

  const load = useCallback(async (manual = false) => {
    if (loading.current) return
    loading.current = true
    try {
      const response = await fetch(basePath === '/api/assistance' ? `${basePath}/feed` : basePath)
      if (!response.ok) throw new Error('LOAD_FAILED')
      const next = await response.json() as Feed
      const actionable = next.items.filter(item => item.actionable)
      if (initialized.current) {
        const fresh = actionable.filter(item => !knownActionableIds.current.has(`${item.kind}-${item.id}`)).length
        if (fresh) {
          setNewCount(count => count + fresh)
          setMessage(`${fresh === 1 ? 'Llegó una nueva solicitud' : `Llegaron ${fresh} solicitudes nuevas`}.`)
          document.title = `(${next.pendingCount}) Asistencia · Tutorías`
        }
      }
      knownActionableIds.current = new Set(actionable.map(item => `${item.kind}-${item.id}`))
      initialized.current = true
      setFeed(next)
      if (manual) setMessage('Lista actualizada.')
    } catch {
      setMessage('No se pudo actualizar la asistencia.')
    } finally {
      loading.current = false
    }
  }, [basePath])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 12_000)
    return () => { window.clearInterval(timer); document.title = 'Búsqueda del Tesoro' }
  }, [load])

  const resolve = async (item: FeedItem, body: Record<string, unknown>) => {
    const key = `${item.kind}-${item.id}`
    setBusyKey(key); setMessage('')
    const path = item.kind === 'ANSWER_REVIEW' ? `reviews/${item.id}/resolve` : `support/${item.id}/resolve`
    try {
      const response = await fetch(`${basePath}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error('ACTION_FAILED')
      const terminalStatus = item.kind === 'ANSWER_REVIEW' ? (body.approve ? 'APPROVED' : 'REJECTED') : 'RESOLVED'
      setFeed(current => current ? {
        pendingCount: Math.max(0, current.pendingCount - (item.actionable ? 1 : 0)),
        items: current.items.map(candidate => candidate.kind === item.kind && candidate.id === item.id ? { ...candidate, status: terminalStatus, actionable: false } : candidate)
          .sort((left, right) => Number(right.actionable) - Number(left.actionable) || new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
      } : current)
      setMessage(item.kind === 'ANSWER_REVIEW' ? (body.approve ? 'Respuesta aprobada.' : 'Respuesta rechazada.') : 'Aviso resuelto.')
    } catch {
      setMessage('No se pudo completar la acción. Intentá nuevamente.')
    } finally {
      setBusyKey('')
    }
  }

  if (!feed) return <p>Cargando asistencia…</p>
  return <section className="mx-auto w-full max-w-4xl overflow-x-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-black">Asistencia <span className="rounded bg-red-600 px-2 py-1 text-sm text-white">{feed.pendingCount}</span></h1>
      <button type="button" className="rounded border bg-white px-4 py-2 text-sm font-bold hover:bg-neutral-100 active:scale-95 disabled:opacity-50" disabled={loading.current} onClick={() => void load(true)}>Actualizar</button>
    </div>
    <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
      <p><strong>Aprobar:</strong> acepta la respuesta y aplica la corrección calculada por el servidor.</p>
      <p><strong>Rechazar:</strong> conserva el resultado incorrecto original.</p>
      <p><strong>Resolver:</strong> marca un problema de QR o ayuda como atendido.</p>
    </div>
    {(message || newCount > 0) && <div role="status" className="mt-3 rounded bg-amber-100 p-3 text-sm font-bold text-amber-950">{message}<button type="button" className="ml-3 underline" onClick={() => { setMessage(''); setNewCount(0) }}>Cerrar</button></div>}
    <div className="mt-5 space-y-3">
      {feed.items.map(item => {
        const key = `${item.kind}-${item.id}`
        const busy = busyKey === key
        return <article key={key} className={`min-w-0 rounded border bg-white p-4 shadow-sm ${item.actionable ? 'border-l-4 border-l-orange-500' : 'opacity-75'}`}>
          {item.kind === 'SUPPORT' ? <>
            <h2 className="break-words text-base font-black">{item.category === 'QR_DAMAGED' ? `QR ROTO O EXTRAVIADO EN ${(item.label ?? 'ESTACIÓN').toUpperCase()}` : item.category === 'QR_SCAN' ? `PROBLEMA PARA ESCANEAR EN ${(item.label ?? 'ESTACIÓN').toUpperCase()}` : 'OTRO PEDIDO DE AYUDA'}</h2>
            <p className="mt-1 break-words text-sm">Participante: <strong>{item.display_name}</strong></p>
            <p className="text-xs text-neutral-600">{new Date(item.created_at).toLocaleString('es-AR')} · {item.status} · Sesión {item.session_id}</p>
            {item.note && <p className="mt-2 break-words text-sm">{item.note}</p>}
            {item.actionable && <button disabled={busy} className="mt-3 w-full rounded border px-3 py-2 font-bold hover:bg-neutral-100 active:scale-[.99] disabled:opacity-50 sm:w-auto" onClick={() => void resolve(item, {})}>{busy ? 'Resolviendo…' : 'Resolver'}</button>}
          </> : <>
            <h2 className="break-words text-base font-black">RESPUESTA A REVISAR · {item.display_name}</h2>
            <p className="mt-1 text-sm"><strong>Checkpoint:</strong> {item.label}</p>
            <p className="mt-2 break-words text-sm"><strong>Pregunta:</strong> {item.question_text}</p>
            <p className="mt-2 break-words rounded bg-amber-50 p-2 text-sm"><strong>Respuesta enviada:</strong> {item.raw_answer}</p>
            <p className="mt-2 break-words text-sm"><strong>Respuesta canónica:</strong> {item.canonical_answer}</p>
            <p className="break-words text-sm"><strong>Alias aceptados:</strong> {item.accepted_aliases?.length ? item.accepted_aliases.join(' · ') : 'Sin alias'}</p>
            <p className="mt-2 text-xs text-neutral-600">{new Date(item.created_at).toLocaleString('es-AR')} · {item.status} · Puntaje al solicitar: {item.score_at_request} · Sesión {item.session_id}</p>
            {item.actionable && <div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busy} className="rounded bg-green-700 px-3 py-2 font-bold text-white hover:bg-green-800 active:scale-[.99] disabled:opacity-50" onClick={() => void resolve(item, { approve: true })}>{busy ? 'Procesando…' : 'Aprobar'}</button><button disabled={busy} className="rounded bg-red-700 px-3 py-2 font-bold text-white hover:bg-red-800 active:scale-[.99] disabled:opacity-50" onClick={() => void resolve(item, { approve: false })}>{busy ? 'Procesando…' : 'Rechazar'}</button>{allowAlias && <button disabled={busy} className="col-span-2 rounded border px-3 py-2 text-sm font-bold hover:bg-neutral-100 disabled:opacity-50" onClick={() => void resolve(item, { approve: true, addAlias: true })}>Aprobar y agregar como alias</button>}</div>}
          </>}
        </article>
      })}
      {!feed.items.length && <p className="rounded border bg-white p-5 text-sm text-neutral-600">No hay solicitudes de asistencia.</p>}
    </div>
  </section>
}
