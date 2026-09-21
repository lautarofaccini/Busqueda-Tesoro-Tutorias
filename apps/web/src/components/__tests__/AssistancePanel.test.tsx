import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistancePanel } from '../AssistancePanel'

const items = [
  { id: 8, kind: 'SUPPORT', actionable: true, status: 'PENDING', category: 'QR_DAMAGED', created_at: '2026-09-21T17:24:00Z', display_name: 'Lautaro', label: 'Terraza', session_id: 4 },
  { id: 7, kind: 'ANSWER_REVIEW', actionable: true, status: 'PENDING', created_at: '2026-09-21T17:20:00Z', display_name: 'Ada', label: 'Biblioteca', session_id: 3, question_text: '¿Pregunta?', raw_answer: 'respuesta estudiante', canonical_answer: 'respuesta correcta', accepted_aliases: ['alias'], score_at_request: 80 },
] as const

const newReview = { id: 9, kind: 'ANSWER_REVIEW' as const, actionable: true, status: 'PENDING', created_at: '2026-09-21T17:25:00Z', display_name: 'Lautaro', label: 'Cantina', session_id: 5, question_text: '¿Otra pregunta?', raw_answer: 'respuesta', canonical_answer: 'correcta', accepted_aliases: [], score_at_request: 70 }
const newOther = { id: 10, kind: 'SUPPORT' as const, actionable: true, status: 'PENDING', category: 'OTHER', created_at: '2026-09-21T17:26:00Z', display_name: 'Sol', label: 'CET', session_id: 6 }

let oscillatorStarts: ReturnType<typeof vi.fn>
let notificationCalls: Array<{ title: string; options?: NotificationOptions }>
let requestPermission: ReturnType<typeof vi.fn>

function installAttentionMocks(permission: NotificationPermission = 'default') {
  oscillatorStarts = vi.fn()
  class MockAudioContext {
    state: AudioContextState = 'running'
    currentTime = 0
    destination = {}
    resume = vi.fn().mockResolvedValue(undefined)
    close = vi.fn().mockResolvedValue(undefined)
    createOscillator = () => ({ type: 'sine', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: oscillatorStarts, stop: vi.fn() })
    createGain = () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() })
  }
  vi.stubGlobal('AudioContext', MockAudioContext)

  notificationCalls = []
  requestPermission = vi.fn().mockResolvedValue(permission)
  class MockNotification {
    static permission = permission
    static requestPermission = requestPermission
    onclick: (() => void) | null = null
    close = vi.fn()
    constructor(title: string, options?: NotificationOptions) { notificationCalls.push(options ? { title, options } : { title }) }
  }
  vi.stubGlobal('Notification', MockNotification)
}

function feedResponse(feedItems: readonly unknown[]) {
  return new Response(JSON.stringify({ pendingCount: feedItems.filter(item => (item as { actionable?: boolean }).actionable).length, items: feedItems }), { status: 200 })
}

describe('AssistancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    installAttentionMocks()
    global.fetch = vi.fn(async (_input, init) => init?.method === 'POST'
      ? new Response(JSON.stringify({ success: true }), { status: 200 })
      : feedResponse(items)) as typeof fetch
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  it('shows one chronological feed with explicit QR and complete review context', async () => {
    render(<AssistancePanel basePath="/api/assistance" />)
    const qr = await screen.findByText('QR ROTO O EXTRAVIADO EN TERRAZA')
    const review = screen.getByText('RESPUESTA A REVISAR · Ada')
    expect(qr.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Pregunta:').closest('p')).toHaveTextContent('¿Pregunta?')
    expect(screen.getByText('Respuesta enviada:').closest('p')).toHaveTextContent('respuesta estudiante')
    expect(screen.getByText('Respuesta canónica:').closest('p')).toHaveTextContent('respuesta correcta')
    expect(screen.getByText('Alias aceptados:').closest('p')).toHaveTextContent('alias')
  })

  it('updates an approved card in place and exposes manual refresh', async () => {
    const user = userEvent.setup()
    render(<AssistancePanel basePath="/api/assistance" />)
    await screen.findByText('RESPUESTA A REVISAR · Ada')
    await user.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(await screen.findByText('Respuesta aprobada.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/assistance/reviews/7/resolve', expect.objectContaining({ method: 'POST' }))
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/assistance/feed'))
  })

  it('polls the visible assistance feed every five seconds without overlapping', async () => {
    vi.useFakeTimers()
    render(<AssistancePanel basePath="/api/assistance" />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(4_999) })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('does not beep on initial load or an unchanged refresh', async () => {
    const user = userEvent.setup()
    render(<AssistancePanel basePath="/api/assistance" />)
    await screen.findByText('QR ROTO O EXTRAVIADO EN TERRAZA')
    expect(oscillatorStarts).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Activar sonido' }))
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(oscillatorStarts).not.toHaveBeenCalled()
  })

  it('beeps once, shows a banner, and highlights one genuinely new actionable item', async () => {
    let currentItems: readonly unknown[] = items
    global.fetch = vi.fn(async () => feedResponse(currentItems)) as typeof fetch
    const user = userEvent.setup()
    render(<AssistancePanel basePath="/api/assistance" />)
    await screen.findByText('QR ROTO O EXTRAVIADO EN TERRAZA')
    await user.click(screen.getByRole('button', { name: 'Activar sonido' }))
    currentItems = [newReview, ...items]
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByText('Nueva solicitud de asistencia')).toBeInTheDocument()
    expect(oscillatorStarts).toHaveBeenCalledTimes(1)
    expect(screen.getByText('RESPUESTA A REVISAR · Lautaro').closest('article')).toHaveClass('ring-2')
  })

  it('emits one beep for several new items and never repeats it for the same IDs', async () => {
    let currentItems: readonly unknown[] = items
    global.fetch = vi.fn(async () => feedResponse(currentItems)) as typeof fetch
    const user = userEvent.setup()
    render(<AssistancePanel basePath="/api/assistance" />)
    await screen.findByText('QR ROTO O EXTRAVIADO EN TERRAZA')
    await user.click(screen.getByRole('button', { name: 'Activar sonido' }))
    currentItems = [newOther, newReview, ...items]
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    await screen.findByText('Hay 2 pedidos nuevos pendientes.')
    expect(oscillatorStarts).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3))
    expect(oscillatorStarts).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('RESPUESTA A REVISAR · Lautaro')).toHaveLength(1)
  })

  it('does not alert for a newly returned resolved/history item', async () => {
    let currentItems: readonly unknown[] = items
    global.fetch = vi.fn(async () => feedResponse(currentItems)) as typeof fetch
    const user = userEvent.setup()
    render(<AssistancePanel basePath="/api/assistance" />)
    await screen.findByText('QR ROTO O EXTRAVIADO EN TERRAZA')
    await user.click(screen.getByRole('button', { name: 'Activar sonido' }))
    currentItems = [{ ...newReview, actionable: false, status: 'REJECTED' }, ...items]
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(oscillatorStarts).not.toHaveBeenCalled()
    expect(screen.queryByText('Nueva solicitud de asistencia')).not.toBeInTheDocument()
  })

  it('requests notification permission only after the tutor presses the control', async () => {
    const user = userEvent.setup()
    render(<AssistancePanel basePath="/api/assistance" />)
    await screen.findByText('QR ROTO O EXTRAVIADO EN TERRAZA')
    expect(requestPermission).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Activar notificaciones' }))
    expect(requestPermission).toHaveBeenCalledOnce()
  })

  it('sends one browser notification for a new actionable item after permission is granted', async () => {
    installAttentionMocks('granted')
    let currentItems: readonly unknown[] = items
    global.fetch = vi.fn(async () => feedResponse(currentItems)) as typeof fetch
    const user = userEvent.setup()
    render(<AssistancePanel basePath="/api/assistance" />)
    await screen.findByText('QR ROTO O EXTRAVIADO EN TERRAZA')
    currentItems = [newReview, ...items]
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    await screen.findByText('Nueva solicitud de asistencia')
    expect(notificationCalls).toHaveLength(1)
    expect(notificationCalls[0]).toMatchObject({ title: 'Respuesta para revisar', options: { body: 'Lautaro · CANTINA' } })
  })

  it('keeps the assistance feed usable when notification permission is denied', async () => {
    installAttentionMocks('denied')
    const user = userEvent.setup()
    render(<AssistancePanel basePath="/api/assistance" />)
    await screen.findByText('QR ROTO O EXTRAVIADO EN TERRAZA')
    expect(screen.getByRole('button', { name: 'Notificaciones bloqueadas' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByText('Lista actualizada.')).toBeInTheDocument()
    expect(notificationCalls).toHaveLength(0)
  })

  it('continues polling and notifies when the assistance tab is hidden', async () => {
    installAttentionMocks('granted')
    vi.useFakeTimers()
    let currentItems: readonly unknown[] = items
    global.fetch = vi.fn(async () => feedResponse(currentItems)) as typeof fetch
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    render(<AssistancePanel basePath="/api/assistance" />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    currentItems = [newOther, ...items]
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(notificationCalls).toHaveLength(1)
    expect(notificationCalls[0]?.title).toBe('Nueva solicitud de ayuda')
  })
})
