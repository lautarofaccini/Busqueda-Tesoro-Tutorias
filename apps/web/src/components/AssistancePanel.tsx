import { useCallback, useEffect, useRef, useState } from 'react'
import { formatEventDateTime, parsePersistedUtc } from '../lib/eventTime'

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

const SOUND_PREFERENCE_KEY = 'tutorias:assistance-sound-enabled'
const HIGHLIGHT_DURATION_MS = 8_000

function itemKey(item: FeedItem) {
  return `${item.kind}-${item.id}`
}

function itemElementId(item: FeedItem) {
  return `assistance-${item.kind.toLowerCase()}-${item.id}`
}

function notificationCopy(item: FeedItem) {
  const checkpoint = (item.label ?? 'Estación').toUpperCase()
  if (item.kind === 'ANSWER_REVIEW') return { title: 'Respuesta para revisar', body: `${item.display_name} · ${checkpoint}` }
  if (item.category === 'QR_DAMAGED') return { title: 'QR roto o extraviado', body: checkpoint }
  if (item.category === 'QR_SCAN') return { title: 'Problema para escanear', body: `${item.display_name} · ${checkpoint}` }
  return { title: 'Nueva solicitud de ayuda', body: `${item.display_name} · ${checkpoint}` }
}

type AudioContextConstructor = new () => AudioContext

export function AssistancePanel({ basePath, allowAlias = false }: { basePath: '/api/admin/assistance' | '/api/assistance'; allowAlias?: boolean }) {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [message, setMessage] = useState('')
  const [newCount, setNewCount] = useState(0)
  const [newItemKeys, setNewItemKeys] = useState<Set<string>>(new Set())
  const [busyKey, setBusyKey] = useState('')
  const [soundReady, setSoundReady] = useState(false)
  const [soundUnavailable, setSoundUnavailable] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const loading = useRef(false)
  const seenActionableIds = useRef(new Set<string>())
  const initialized = useRef(false)
  const audioContext = useRef<AudioContext | null>(null)
  const soundReadyRef = useRef(false)
  const notificationPermissionRef = useRef<NotificationPermission | 'unsupported'>(notificationPermission)
  const highlightTimer = useRef<number | undefined>(undefined)

  const activateSound = useCallback(async () => {
    const WindowWithWebkitAudio = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
    const AudioContextClass = window.AudioContext ?? WindowWithWebkitAudio.webkitAudioContext
    if (!AudioContextClass) {
      setSoundUnavailable(true)
      return
    }
    try {
      const context = audioContext.current ?? new AudioContextClass()
      audioContext.current = context
      if (context.state === 'suspended') await context.resume()
      soundReadyRef.current = true
      setSoundReady(true)
      setSoundUnavailable(false)
      try { window.sessionStorage.setItem(SOUND_PREFERENCE_KEY, 'true') } catch { /* Preference persistence is optional. */ }
    } catch {
      setSoundUnavailable(true)
    }
  }, [])

  const playAlertSound = useCallback(() => {
    const context = audioContext.current
    if (!soundReadyRef.current || !context) return
    const emit = () => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(720, context.currentTime)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(context.currentTime)
      oscillator.stop(context.currentTime + 0.17)
    }
    try {
      if (context.state === 'running') emit()
      else void context.resume().then(emit).catch(() => undefined)
    } catch { /* Audio is supplementary; the in-app alert remains available. */ }
  }, [])

  const notifyNewItems = useCallback((fresh: FeedItem[]) => {
    if (!fresh.length) return
    playAlertSound()
    if (notificationPermissionRef.current !== 'granted' || typeof Notification === 'undefined') return
    const primary = fresh[0]!
    const copy = fresh.length === 1
      ? notificationCopy(primary)
      : { title: 'Nuevas solicitudes de asistencia', body: `${fresh.length} solicitudes pendientes` }
    try {
      const notification = new Notification(copy.title, { body: copy.body, tag: `assistance-${itemKey(primary)}` })
      notification.onclick = () => {
        window.focus()
        document.getElementById(itemElementId(primary))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        notification.close()
      }
    } catch {
      // Permission and support can change while the page is open.
    }
  }, [playAlertSound])

  const load = useCallback(async (manual = false) => {
    if (loading.current) return
    loading.current = true
    try {
      const response = await fetch(basePath === '/api/assistance' ? `${basePath}/feed` : basePath)
      if (!response.ok) throw new Error('LOAD_FAILED')
      const next = await response.json() as Feed
      const actionable = next.items.filter(item => item.actionable)
      if (initialized.current) {
        const fresh = actionable.filter(item => !seenActionableIds.current.has(itemKey(item)))
        if (fresh.length) {
          const freshKeys = new Set(fresh.map(itemKey))
          setNewCount(count => count + fresh.length)
          setNewItemKeys(freshKeys)
          if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
          highlightTimer.current = window.setTimeout(() => setNewItemKeys(new Set()), HIGHLIGHT_DURATION_MS)
          document.title = `(${next.pendingCount}) Asistencia · Tutorías`
          notifyNewItems(fresh)
        }
      }
      for (const item of actionable) seenActionableIds.current.add(itemKey(item))
      initialized.current = true
      setFeed(next)
      if (manual) setMessage('Lista actualizada.')
    } catch {
      setMessage('No se pudo actualizar la asistencia.')
    } finally {
      loading.current = false
    }
  }, [basePath, notifyNewItems])

  useEffect(() => {
    notificationPermissionRef.current = notificationPermission
  }, [notificationPermission])

  useEffect(() => {
    let preferred = false
    try { preferred = window.sessionStorage.getItem(SOUND_PREFERENCE_KEY) === 'true' } catch { /* Ignore unavailable storage. */ }
    if (!preferred || soundReadyRef.current) return
    const resumeAfterInteraction = () => void activateSound()
    window.addEventListener('pointerdown', resumeAfterInteraction, { once: true })
    window.addEventListener('keydown', resumeAfterInteraction, { once: true })
    return () => {
      window.removeEventListener('pointerdown', resumeAfterInteraction)
      window.removeEventListener('keydown', resumeAfterInteraction)
    }
  }, [activateSound])

  useEffect(() => {
    let stopped = false
    let timer: number | undefined
    const poll = async () => {
      await load()
      if (!stopped) timer = window.setTimeout(() => void poll(), 5_000)
    }
    void load()
    timer = window.setTimeout(() => void poll(), 5_000)
    return () => { stopped = true; if (timer) window.clearTimeout(timer); if (highlightTimer.current) window.clearTimeout(highlightTimer.current); void audioContext.current?.close(); document.title = 'Búsqueda del Tesoro' }
  }, [load])

  const activateNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported')
      return
    }
    try {
      const permission = await Notification.requestPermission()
      notificationPermissionRef.current = permission
      setNotificationPermission(permission)
    } catch {
      notificationPermissionRef.current = 'denied'
      setNotificationPermission('denied')
    }
  }

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
          .sort((left, right) => Number(right.actionable) - Number(left.actionable) || parsePersistedUtc(right.created_at).getTime() - parsePersistedUtc(left.created_at).getTime()),
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
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="rounded border bg-white px-3 py-2 text-sm font-bold hover:bg-neutral-100 disabled:opacity-60" disabled={soundReady || soundUnavailable} onClick={() => void activateSound()}>{soundReady ? 'Sonido activado' : soundUnavailable ? 'Sonido no disponible' : 'Activar sonido'}</button>
      {notificationPermission !== 'unsupported' && <button type="button" className="rounded border bg-white px-3 py-2 text-sm font-bold hover:bg-neutral-100 disabled:opacity-60" disabled={notificationPermission === 'granted' || notificationPermission === 'denied'} onClick={() => void activateNotifications()}>{notificationPermission === 'granted' ? 'Notificaciones activadas' : notificationPermission === 'denied' ? 'Notificaciones bloqueadas' : 'Activar notificaciones'}</button>}
    </div>
    <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
      <p><strong>Aprobar:</strong> acepta la respuesta y aplica la corrección calculada por el servidor.</p>
      <p><strong>Rechazar:</strong> conserva el resultado incorrecto original.</p>
      <p><strong>Resolver:</strong> marca un problema de QR o ayuda como atendido.</p>
    </div>
    {newCount > 0 && <div role="alert" className="mt-3 rounded border border-orange-300 bg-amber-100 p-3 text-sm text-amber-950"><p className="font-black">Nueva solicitud de asistencia</p><p>{newCount === 1 ? 'Hay un pedido nuevo pendiente.' : `Hay ${newCount} pedidos nuevos pendientes.`}</p><button type="button" className="mt-1 font-bold underline" onClick={() => setNewCount(0)}>Cerrar</button></div>}
    {message && <div role="status" className="mt-3 rounded bg-blue-50 p-3 text-sm font-bold text-blue-950">{message}<button type="button" className="ml-3 underline" onClick={() => setMessage('')}>Cerrar</button></div>}
    <div className="mt-5 space-y-3">
      {feed.items.map(item => {
        const key = `${item.kind}-${item.id}`
        const busy = busyKey === key
        return <article id={itemElementId(item)} key={key} className={`min-w-0 rounded border bg-white p-4 shadow-sm transition-all ${item.actionable ? 'border-l-4 border-l-orange-500' : 'opacity-75'} ${newItemKeys.has(key) ? 'ring-2 ring-orange-400 bg-orange-50' : ''}`}>
          {item.kind === 'SUPPORT' ? <>
            <h2 className="break-words text-base font-black">{item.category === 'QR_DAMAGED' ? `QR ROTO O EXTRAVIADO EN ${(item.label ?? 'ESTACIÓN').toUpperCase()}` : item.category === 'QR_SCAN' ? `PROBLEMA PARA ESCANEAR EN ${(item.label ?? 'ESTACIÓN').toUpperCase()}` : 'OTRO PEDIDO DE AYUDA'}</h2>
            <p className="mt-1 break-words text-sm">Participante: <strong>{item.display_name}</strong></p>
            <p className="text-xs text-neutral-600">{formatEventDateTime(item.created_at)} · {item.status} · Sesión {item.session_id}</p>
            {item.note && <p className="mt-2 break-words text-sm">{item.note}</p>}
            {item.actionable && <button disabled={busy} className="mt-3 w-full rounded border px-3 py-2 font-bold hover:bg-neutral-100 active:scale-[.99] disabled:opacity-50 sm:w-auto" onClick={() => void resolve(item, {})}>{busy ? 'Resolviendo…' : 'Resolver'}</button>}
          </> : <>
            <h2 className="break-words text-base font-black">RESPUESTA A REVISAR · {item.display_name}</h2>
            <p className="mt-1 text-sm"><strong>Checkpoint:</strong> {item.label}</p>
            <p className="mt-2 break-words text-sm"><strong>Pregunta:</strong> {item.question_text}</p>
            <p className="mt-2 break-words rounded bg-amber-50 p-2 text-sm"><strong>Respuesta enviada:</strong> {item.raw_answer}</p>
            <p className="mt-2 break-words text-sm"><strong>Respuesta canónica:</strong> {item.canonical_answer}</p>
            <p className="break-words text-sm"><strong>Alias aceptados:</strong> {item.accepted_aliases?.length ? item.accepted_aliases.join(' · ') : 'Sin alias'}</p>
            <p className="mt-2 text-xs text-neutral-600">{formatEventDateTime(item.created_at)} · {item.status} · Puntaje al solicitar: {item.score_at_request} · Sesión {item.session_id}</p>
            {item.actionable && <div className="mt-3 grid grid-cols-2 gap-2"><button disabled={busy} className="rounded bg-green-700 px-3 py-2 font-bold text-white hover:bg-green-800 active:scale-[.99] disabled:opacity-50" onClick={() => void resolve(item, { approve: true })}>{busy ? 'Procesando…' : 'Aprobar'}</button><button disabled={busy} className="rounded bg-red-700 px-3 py-2 font-bold text-white hover:bg-red-800 active:scale-[.99] disabled:opacity-50" onClick={() => void resolve(item, { approve: false })}>{busy ? 'Procesando…' : 'Rechazar'}</button>{allowAlias && <button disabled={busy} className="col-span-2 rounded border px-3 py-2 text-sm font-bold hover:bg-neutral-100 disabled:opacity-50" onClick={() => void resolve(item, { approve: true, addAlias: true })}>Aprobar y agregar como alias</button>}</div>}
          </>}
        </article>
      })}
      {!feed.items.length && <p className="rounded border bg-white p-5 text-sm text-neutral-600">No hay solicitudes de asistencia.</p>}
    </div>
  </section>
}
