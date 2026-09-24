import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerDetailDrawer, type PlayerDetail } from '../PlayerDetailDrawer'

const detail: PlayerDetail = {
  id: 201,
  playerName: 'Ana Activa',
  career: 'ISI',
  identifierType: 'DNI',
  identifierSuffix: '101',
  status: 'active',
  currentState: 'RESPONDIENDO',
  currentStep: 1,
  totalSteps: 2,
  startedAt: '2026-09-23 13:50:00',
  completedAt: null,
  score: 75,
  errors: 2,
  questionHints: 1,
  navigationHints: 1,
  pendingReview: true,
  stateSince: '2026-09-23 14:00:00',
  stateSinceSource: 'CHECKPOINT_UNLOCK_SCAN',
  currentQuestion: { checkpoint: 'CANTINA', question: '¿Pregunta actual?', assignedAt: '2026-09-23 14:00:00', hintUsedAt: '2026-09-23 14:01:00' },
  destination: null,
  history: [{
    stepPosition: 1,
    checkpoint: 'CANTINA',
    question: '¿Pregunta actual?',
    assignedAt: '2026-09-23 14:00:00',
    hintUsedAt: '2026-09-23 14:01:00',
    routeHintUsedAt: null,
    attempts: [
      { answer: 'Libre', correct: false, attemptedAt: '2026-09-23 14:00:10', scoreEffect: -10, reviewStatus: 'REJECTED', reviewRequestedAt: '2026-09-23 14:00:11', reviewResolvedAt: '2026-09-23 14:00:12' },
      { answer: 'Tranquilo', correct: false, attemptedAt: '2026-09-23 14:00:20', scoreEffect: -10, reviewStatus: 'PENDING', reviewRequestedAt: '2026-09-23 14:00:21', reviewResolvedAt: null },
    ],
  }],
}

const completedDetail: PlayerDetail = {
  ...detail,
  status: 'completed',
  currentState: 'FINALIZADO',
  completedAt: '2026-09-23 14:00:00',
  stateSince: '2026-09-23 14:00:00',
  pendingReview: false,
  currentQuestion: null,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-23T14:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('player detail drawer', () => {
  it('shows authoritative state, current question, history and closes without navigation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 })))
    const close = vi.fn()
    render(<PlayerDetailDrawer sessionId={201} onClose={close} />)
    await act(async () => {})
    expect(screen.getByText('RESPONDIENDO')).toBeInTheDocument()
    expect(screen.getByText('REVISIÓN PENDIENTE')).toBeInTheDocument()
    expect(screen.getAllByText('¿Pregunta actual?')).toHaveLength(2)
    expect(screen.getByText('“Libre”')).toBeInTheDocument()
    expect(screen.getByText(/Revisión: rechazada/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(close).toHaveBeenCalledOnce()
  })

  it('ticks duration locally and polls every five seconds without overlapping', async () => {
    let resolveFirst!: (response: Response) => void
    const first = new Promise<Response>(resolve => { resolveFirst = resolve })
    const fetchMock = vi.fn().mockReturnValueOnce(first).mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PlayerDetailDrawer sessionId={201} onClose={() => undefined} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { resolveFirst(new Response(JSON.stringify(detail), { status: 200 })); await first })
    expect(screen.getByText(/En este estado hace: 00:10/)).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows fixed terminal duration and Argentina completion time without polling or ticking', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(completedDetail), { status: 200 }))
    const intervalSpy = vi.spyOn(window, 'setInterval')
    vi.stubGlobal('fetch', fetchMock)
    render(<PlayerDetailDrawer sessionId={201} onClose={() => undefined} />)
    await act(async () => {})
    expect(screen.getByText('Duración total: 10:00')).toBeInTheDocument()
    expect(screen.getByText('Finalizó: 11:00:00')).toBeInTheDocument()
    expect(screen.queryByText(/En este estado hace/)).not.toBeInTheDocument()
    expect(intervalSpy).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('performs the completion refresh and then stops future polling', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(completedDetail), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PlayerDetailDrawer sessionId={201} onClose={() => undefined} />)
    await act(async () => {})
    expect(screen.getByText('RESPONDIENDO')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
    expect(screen.getByText('FINALIZADO')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('requires a reason and explicit preview before applying a score correction', async () => {
    const auditable = { ...completedDetail, score: 540, auditStatus: 'PENDING', approvedReviewCount: 1, scoreBreakdown: { rawCorrectCount: 6, rawWrongCount: 6, hintCount: 0, baseScore: 540, manualAdjustmentTotal: 0, finalScore: 540 }, scoreAdjustments: [], auditSuggestions: [{ code: 'APPROVED_REVIEW', label: 'Hay una revisión aprobada para inspeccionar.' }], history: completedDetail.history.map(item => ({ ...item, attempts: item.attempts.map((attempt, index) => index === 1 ? { ...attempt, reviewStatus: 'APPROVED' as const, reviewRequiresManualAudit: true } : attempt) })) }
    const corrected = { ...auditable, score: 550, scoreBreakdown: { rawCorrectCount: 6, rawWrongCount: 6, hintCount: 0, baseScore: 540, manualAdjustmentTotal: 10, finalScore: 550 }, scoreAdjustments: [{ id: 1, amount: 10, reason: 'Penalidad incorrecta verificada', createdAt: '2026-09-23 15:00:00', createdBy: 'adminTutores21', relatedAttemptId: null, compensatesAdjustmentId: null }] }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(auditable), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, score: 550 }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(corrected), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<PlayerDetailDrawer sessionId={201} onClose={() => undefined} />)
    await act(async () => {})
    expect(screen.getByText('Revisiones aprobadas: 1 · sin impacto automático en el puntaje.')).toBeInTheDocument()
    expect(screen.getByText('Revisión: aprobada · requiere auditoría manual del puntaje')).toBeInTheDocument()
    expect(screen.queryByText(/corrección \+/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Corregir puntaje' }))
    fireEvent.click(screen.getByRole('button', { name: '+10' }))
    fireEvent.change(screen.getByLabelText('Motivo obligatorio'), { target: { value: 'Penalidad incorrecta verificada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar corrección' }))
    expect(screen.getByText('El puntaje de Ana Activa cambiará de 540 a 550.')).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar corrección' })) })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/organizer/players/201/score-adjustments', expect.objectContaining({ method: 'POST' }))
    await act(async () => {})
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('Penalidad incorrecta verificada') === true)).toBeInTheDocument()
  })
})
