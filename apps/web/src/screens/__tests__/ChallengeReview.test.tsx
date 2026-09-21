import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '@busqueda-tesoro/shared'
import { ChallengeScreen } from '../CheckpointScan'
import * as client from '../../api/client'

vi.mock('../../api/client', () => ({
  submitAnswer: vi.fn(),
  revealQuestionHint: vi.fn(),
  submitAnswerReview: vi.fn(),
  getSupportStatus: vi.fn(),
  getGameState: vi.fn(),
  scanToken: vi.fn(),
  startSession: vi.fn(),
}))

const wrongState = {
  state: 'ANSWER_INCORRECT' as const,
  challengeId: 7,
  question: '¿Pregunta de prueba?',
  stepNumber: 1,
  totalSteps: 5,
  playerName: 'Ada',
  score: -10,
  attemptId: 42,
  hasHint: true,
}

describe('Challenge review UX', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })))
    vi.mocked(client.getSupportStatus).mockResolvedValue({ reviews: [], support: [] })
  })

  it('requires confirmation before submitting a review', async () => {
    const user = userEvent.setup()
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Creo que mi respuesta fue correcta' }))
    expect(screen.getByText('Tu respuesta quedará en evaluación por Tutorías.')).toBeInTheDocument()
    expect(client.submitAnswerReview).not.toHaveBeenCalled()
    vi.mocked(client.submitAnswerReview).mockResolvedValue({ success: true })
    await user.click(screen.getByRole('button', { name: 'Enviar a revisión' }))
    expect(client.submitAnswerReview).toHaveBeenCalledWith(42)
  })

  it('restores a persisted pending review and hides duplicate submission', async () => {
    vi.mocked(client.getSupportStatus).mockResolvedValue({ reviews: [{ id: 3, challenge_id: 7, answer_attempt_id: 42, status: 'PENDING', created_at: new Date().toISOString(), scoreCorrection: 0 }], support: [] })
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    expect(await screen.findByText('Respuesta en evaluación')).toBeInTheDocument()
    expect(screen.getByText(/Podés seguir intentando/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Creo que mi respuesta fue correcta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Responder' })).toBeEnabled()
  })

  it('shows the five-minute office escalation from the persisted timestamp', async () => {
    vi.mocked(client.getSupportStatus).mockResolvedValue({ reviews: [{ id: 3, challenge_id: 7, answer_attempt_id: 42, status: 'PENDING', created_at: new Date(Date.now() - 301_000).toISOString(), scoreCorrection: 0 }], support: [] })
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    expect(await screen.findByText((_, element) => element?.textContent === '¿Todavía no tenés respuesta?Acercate a la oficina de Tutorías y te ayudamos.')).toBeInTheDocument()
  })

  it('shows approval correction and reconciles to the current server state', async () => {
    const current = { state: 'ACTIVE' as const, clue: 'Siguiente pista', stepNumber: 2, totalSteps: 5, playerName: 'Ada', score: 100 }
    const onResult = vi.fn()
    vi.mocked(client.getSupportStatus).mockResolvedValue({ reviews: [{ id: 3, challenge_id: 7, answer_attempt_id: 42, status: 'APPROVED', created_at: new Date().toISOString(), resolved_at: new Date().toISOString(), scoreCorrection: 110 }], support: [] })
    vi.mocked(client.getGameState).mockResolvedValue(current)
    render(<ChallengeScreen state={wrongState} onResult={onResult} />)
    expect(await screen.findByText('¡Tu respuesta fue aprobada! Puntaje corregido: +110')).toBeInTheDocument()
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(current), { timeout: 2_000 })
  })

  it('shows rejection without changing or rewinding the current challenge', async () => {
    vi.mocked(client.getSupportStatus).mockResolvedValue({ reviews: [{ id: 3, challenge_id: 7, answer_attempt_id: 42, status: 'REJECTED', created_at: new Date().toISOString(), resolved_at: new Date().toISOString(), scoreCorrection: 0 }], support: [] })
    const onResult = vi.fn()
    render(<ChallengeScreen state={wrongState} onResult={onResult} />)
    expect(await screen.findByText('Tu respuesta fue revisada y no fue aceptada.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Responder' })).toBeEnabled()
    expect(onResult).not.toHaveBeenCalled()
  })

  it('closes the hint confirmation after the server accepts the reveal', async () => {
    const user = userEvent.setup()
    const next = { ...wrongState, hint: 'Pista persistida', score: -15 } satisfies GameState
    vi.mocked(client.revealQuestionHint).mockResolvedValue(next)
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Ver pista (-5)' }))
    expect(screen.getByText('Revelar esta pista descuenta 5 puntos.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revelar pista' }))
    await waitFor(() => expect(screen.queryByText('Revelar esta pista descuenta 5 puntos.')).not.toBeInTheDocument())
  })

  it('keeps the intro for reading but lets the player skip it', async () => {
    const user = userEvent.setup()
    render(<ChallengeScreen state={{ state: 'CHALLENGE', challengeId: 7, question: '¿Pregunta de prueba?', stepNumber: 1, totalSteps: 5, playerName: 'Ada', score: 0, hasHint: false }} onResult={vi.fn()} />)
    expect(screen.getByText('Tocá para responder')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument()
    await user.click(screen.getByText('¿Pregunta de prueba?'))
    expect(screen.getByRole('button', { name: 'Responder' })).toBeInTheDocument()
  })

  it('opens rules without replacing the challenge', async () => {
    const user = userEvent.setup()
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Reglas' }))
    expect(screen.getByRole('dialog', { name: 'Reglas del juego' })).toBeInTheDocument()
    expect(screen.getByText('¿Pregunta de prueba?')).toBeInTheDocument()
  })
})
