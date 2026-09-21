import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '@busqueda-tesoro/shared'
import { ChallengeScreen } from '../CheckpointScan'
import * as client from '../../api/client'

vi.mock('../../api/client', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, public body: Record<string, unknown>) { super(`API error ${status}`) }
  },
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
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
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

  it('replaces pending with rejection when polling resolves the same persisted review', async () => {
    vi.useFakeTimers()
    const pending = { id: 3, challenge_id: 7, answer_attempt_id: 42, status: 'PENDING' as const, created_at: new Date().toISOString(), scoreCorrection: 0 }
    vi.mocked(client.getSupportStatus)
      .mockResolvedValueOnce({ reviews: [pending], support: [] })
      .mockResolvedValue({ reviews: [{ ...pending, status: 'REJECTED', resolved_at: new Date().toISOString() }], support: [] })
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('Respuesta en evaluación')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(screen.queryByText('Respuesta en evaluación')).not.toBeInTheDocument()
    expect(screen.getByText('Tu respuesta fue revisada y no fue aceptada.')).toBeInTheDocument()
    const terminalCallCount = vi.mocked(client.getSupportStatus).mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000) })
    expect(client.getSupportStatus).toHaveBeenCalledTimes(terminalCallCount)
  })

  it('replaces pending with approval and its authoritative correction', async () => {
    vi.useFakeTimers()
    const pending = { id: 3, challenge_id: 7, answer_attempt_id: 42, status: 'PENDING' as const, created_at: new Date().toISOString(), scoreCorrection: 0 }
    vi.mocked(client.getSupportStatus)
      .mockResolvedValueOnce({ reviews: [pending], support: [] })
      .mockResolvedValue({ reviews: [{ ...pending, status: 'APPROVED', resolved_at: new Date().toISOString(), scoreCorrection: 10 }], support: [] })
    vi.mocked(client.getGameState).mockResolvedValue({ state: 'ACTIVE', clue: 'Siguiente', stepNumber: 2, totalSteps: 5, playerName: 'Ada', score: 100 })
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('Respuesta en evaluación')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(screen.queryByText('Respuesta en evaluación')).not.toBeInTheDocument()
    expect(screen.getByText('¡Tu respuesta fue aprobada! Puntaje corregido: +10')).toBeInTheDocument()
  })

  it('isolates a new attempt from an older terminal review', async () => {
    const older = { id: 3, challenge_id: 7, answer_attempt_id: 42, status: 'REJECTED' as const, created_at: new Date(Date.now() - 60_000).toISOString(), scoreCorrection: 0 }
    const newer = { id: 4, challenge_id: 7, answer_attempt_id: 43, status: 'PENDING' as const, created_at: new Date().toISOString(), scoreCorrection: 0 }
    vi.mocked(client.getSupportStatus).mockResolvedValue({ reviews: [newer, older], support: [] })
    const view = render(<ChallengeScreen state={{ ...wrongState, attemptId: 43 }} onResult={vi.fn()} />)
    expect(await screen.findByText('Respuesta en evaluación')).toBeInTheDocument()
    expect(screen.queryByText('Tu respuesta fue revisada y no fue aceptada.')).not.toBeInTheDocument()
    view.rerender(<ChallengeScreen state={{ ...wrongState, attemptId: 42 }} onResult={vi.fn()} />)
    expect(await screen.findByText('Tu respuesta fue revisada y no fue aceptada.')).toBeInTheDocument()
    expect(screen.queryByText('Respuesta en evaluación')).not.toBeInTheDocument()
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
    expect(screen.getByLabelText('Tiempo restante para responder').firstElementChild).toHaveClass('challenge-intro-progress')
    expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument()
    await user.click(screen.getByText('¿Pregunta de prueba?'))
    expect(screen.getByRole('button', { name: 'Responder' })).toBeInTheDocument()
  })

  it('automatically completes the five-second intro', async () => {
    vi.useFakeTimers()
    render(<ChallengeScreen state={{ state: 'CHALLENGE', challengeId: 7, question: '¿Pregunta de prueba?', stepNumber: 1, totalSteps: 5, playerName: 'Ada', score: 0, hasHint: false }} onResult={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(4_999) })
    expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByRole('button', { name: 'Responder' })).toBeInTheDocument()
  })

  it('skips the intro immediately for reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn() })))
    render(<ChallengeScreen state={{ state: 'CHALLENGE', challengeId: 7, question: '¿Pregunta de prueba?', stepNumber: 1, totalSteps: 5, playerName: 'Ada', score: 0, hasHint: false }} onResult={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Responder' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Tiempo restante para responder')).not.toBeInTheDocument()
  })

  it('shows and counts down the authoritative wrong-answer cooldown', async () => {
    vi.useFakeTimers()
    render(<ChallengeScreen state={{ ...wrongState, cooldownRemaining: 2 }} onResult={vi.fn()} />)
    expect(screen.getByText('Podés volver a intentar en 2 s.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Responder' })).toBeDisabled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(screen.queryByText(/Podés volver a intentar/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Responder' })).toBeEnabled()
  })

  it('maps a server cooldown response to the countdown instead of a network error', async () => {
    const user = userEvent.setup()
    vi.mocked(client.submitAnswer).mockRejectedValue(new client.ApiError(429, { error: 'COOLDOWN_ACTIVE', remainingSeconds: 7 }))
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Tu respuesta'), 'otra')
    await user.click(screen.getByRole('button', { name: 'Responder' }))
    expect(await screen.findByText('Podés volver a intentar en 7 s.')).toBeInTheDocument()
    expect(screen.queryByText(/No pudimos conectarnos/)).not.toBeInTheDocument()
  })

  it('keeps a genuine network failure distinct from cooldown', async () => {
    const user = userEvent.setup()
    vi.mocked(client.submitAnswer).mockRejectedValue(new TypeError('network'))
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Tu respuesta'), 'otra')
    await user.click(screen.getByRole('button', { name: 'Responder' }))
    expect(await screen.findByText('No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.')).toBeInTheDocument()
  })

  it('opens rules without replacing the challenge', async () => {
    const user = userEvent.setup()
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Reglas' }))
    expect(screen.getByRole('dialog', { name: 'Reglas del juego' })).toBeInTheDocument()
    expect(screen.getByText('¿Pregunta de prueba?')).toBeInTheDocument()
  })

  it('keeps a secondary help action available on the challenge screen', async () => {
    const user = userEvent.setup()
    render(<ChallengeScreen state={wrongState} onResult={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '¿Necesitás ayuda?' }))
    expect(screen.getByRole('heading', { name: '¿Necesitás ayuda?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'El QR está dañado, fue quitado o no funciona' })).toBeInTheDocument()
  })

  it('always exits the correct-answer success state through authoritative reconciliation', async () => {
    const user = userEvent.setup()
    const accepted = { state: 'ADVANCED' as const, clue: 'Respuesta inicial', stepNumber: 2, totalSteps: 5, playerName: 'Ada', score: 90 }
    const current = { ...accepted, state: 'ACTIVE' as const, clue: 'Pista vigente' }
    vi.mocked(client.submitAnswer).mockResolvedValue(accepted)
    vi.mocked(client.getGameState).mockResolvedValue(current)
    const onResult = vi.fn()
    const view = render(<ChallengeScreen state={wrongState} onResult={onResult} />)
    await user.type(screen.getByPlaceholderText('Tu respuesta'), 'correcta')
    await user.click(screen.getByRole('button', { name: 'Responder' }))
    expect(screen.getByText('¡Correcto!')).toBeInTheDocument()
    view.rerender(<ChallengeScreen state={wrongState} onResult={onResult} />)
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(current), { timeout: 1_500 })
  })

  it('exits success normally even while the disputed attempt remains pending', async () => {
    const user = userEvent.setup()
    const pending = { id: 3, challenge_id: 7, answer_attempt_id: 42, status: 'PENDING' as const, created_at: new Date().toISOString(), scoreCorrection: 0 }
    const next = { state: 'ACTIVE' as const, clue: 'Siguiente', stepNumber: 2, totalSteps: 5, playerName: 'Ada', score: 90 }
    vi.mocked(client.getSupportStatus).mockResolvedValue({ reviews: [pending], support: [] })
    vi.mocked(client.submitAnswer).mockResolvedValue({ ...next, state: 'ADVANCED' })
    vi.mocked(client.getGameState).mockResolvedValue(next)
    const onResult = vi.fn()
    render(<ChallengeScreen state={wrongState} onResult={onResult} />)
    await user.type(screen.getByPlaceholderText('Tu respuesta'), 'correcta')
    await user.click(screen.getByRole('button', { name: 'Responder' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(next), { timeout: 1_500 })
  })

  it('reaches final completion and reduced motion does not leave success mounted', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn() })))
    const user = userEvent.setup()
    const completed = { state: 'COMPLETED' as const, playerName: 'Ada', completedAt: new Date().toISOString(), score: 500 }
    vi.mocked(client.submitAnswer).mockResolvedValue(completed)
    vi.mocked(client.getGameState).mockResolvedValue(completed)
    const onResult = vi.fn()
    render(<ChallengeScreen state={wrongState} onResult={onResult} />)
    await user.type(screen.getByPlaceholderText('Tu respuesta'), 'correcta')
    await user.click(screen.getByRole('button', { name: 'Responder' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(completed))
  })

  it('shows a recoverable state and retries reconciliation without reloading', async () => {
    vi.useFakeTimers()
    const accepted = { state: 'ADVANCED' as const, clue: 'Respuesta inicial', stepNumber: 2, totalSteps: 5, playerName: 'Ada', score: 100 }
    vi.mocked(client.submitAnswer).mockResolvedValue(accepted)
    vi.mocked(client.getGameState).mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ...accepted, state: 'ACTIVE' })
    const onResult = vi.fn()
    render(<ChallengeScreen state={wrongState} onResult={onResult} />)
    fireEvent.change(screen.getByPlaceholderText('Tu respuesta'), { target: { value: 'correcta' } })
    // Use the form directly so fake timers do not interfere with user-event scheduling.
    await act(async () => { screen.getByRole('button', { name: 'Responder' }).click(); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(700); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(800); await Promise.resolve() })
    expect(screen.getByText('No pudimos cargar el siguiente paso.')).toBeInTheDocument()
    await act(async () => { screen.getByRole('button', { name: 'Reintentar' }).click(); await vi.runAllTimersAsync() })
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ state: 'ACTIVE' }))
  })

  it('reconciles three sequential checkpoints and final completion without relying on a remount', async () => {
    vi.useFakeTimers()
    const onResult = vi.fn()
    const activeStates = [1, 2, 3].map(index => ({ state: 'ACTIVE' as const, clue: `Destino ${index}`, stepNumber: index + 1, totalSteps: 4, playerName: 'Ada', score: index * 100 }))
    const completed = { state: 'COMPLETED' as const, playerName: 'Ada', completedAt: new Date().toISOString(), score: 400 }
    vi.mocked(client.submitAnswer)
      .mockResolvedValueOnce({ ...activeStates[0]!, state: 'ADVANCED' })
      .mockResolvedValueOnce({ ...activeStates[1]!, state: 'ADVANCED' })
      .mockResolvedValueOnce({ ...activeStates[2]!, state: 'ADVANCED' })
      .mockResolvedValueOnce(completed)
    vi.mocked(client.getGameState)
      .mockResolvedValueOnce(activeStates[0]!)
      .mockResolvedValueOnce(activeStates[1]!)
      .mockResolvedValueOnce(activeStates[2]!)
      .mockResolvedValueOnce(completed)

    const view = render(<ChallengeScreen state={{ ...wrongState, challengeId: 1, attemptId: 101 }} onResult={onResult} />)
    for (let index = 0; index < 4; index += 1) {
      fireEvent.change(screen.getByPlaceholderText('Tu respuesta'), { target: { value: `correcta ${index}` } })
      await act(async () => { screen.getByRole('button', { name: 'Responder' }).click(); await Promise.resolve() })
      await act(async () => { await vi.advanceTimersByTimeAsync(700); await Promise.resolve() })
      expect(onResult).toHaveBeenCalledTimes(index + 1)
      if (index < 3) {
        view.rerender(<ChallengeScreen state={{ ...wrongState, challengeId: index + 2, attemptId: 102 + index }} onResult={onResult} />)
        await act(async () => { await Promise.resolve() })
      }
    }
    expect(onResult).toHaveBeenLastCalledWith(completed)
  })
})
