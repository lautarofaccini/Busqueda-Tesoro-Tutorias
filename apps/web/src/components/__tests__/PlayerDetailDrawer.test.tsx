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
      { answer: 'Libre', correct: false, attemptedAt: '2026-09-23 14:00:10', scoreEffect: -10, reviewStatus: 'REJECTED', reviewRequestedAt: '2026-09-23 14:00:11', reviewResolvedAt: '2026-09-23 14:00:12', reviewCorrection: 0 },
      { answer: 'Tranquilo', correct: false, attemptedAt: '2026-09-23 14:00:20', scoreEffect: -10, reviewStatus: 'PENDING', reviewRequestedAt: '2026-09-23 14:00:21', reviewResolvedAt: null, reviewCorrection: 0 },
    ],
  }],
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
})
