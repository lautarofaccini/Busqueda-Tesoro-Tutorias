import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrganizerView } from '../OrganizerView'

afterEach(() => vi.restoreAllMocks())

describe('organizer live observability', () => {
  it('shows compact state and opens player detail without reloading the summary', async () => {
    const results = {
      totals: { all: 1, active: 1, completed: 0 }, ranking: [], invalidated: [],
      active: [{ id: 201, playerName: 'Ana', currentStep: 1, totalSteps: 2, wrongCount: 2, startedAt: '2026-09-23 14:00:00', currentState: 'BUSCANDO_QR', stateSince: '2026-09-23 14:00:00', pendingReview: false }],
    }
    const detail = { id: 201, playerName: 'Ana', career: 'ISI', identifierType: 'DNI', identifierSuffix: '101', status: 'active', currentState: 'BUSCANDO_QR', currentStep: 1, totalSteps: 2, startedAt: '2026-09-23 14:00:00', completedAt: null, score: 100, errors: 0, questionHints: 0, navigationHints: 0, pendingReview: false, stateSince: '2026-09-23 14:00:00', stateSinceSource: 'SUCCESSFUL_ADVANCE', currentQuestion: null, destination: { checkpoint: 'CANTINA', clue: 'Pista' }, history: [] }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(results), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detail), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<OrganizerView isEmbedded />)
    expect(await screen.findByText(/BUSCANDO_QR/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))
    expect(await screen.findByRole('dialog', { name: 'Detalle del participante' })).toBeInTheDocument()
    expect(screen.getByText('Buscando el próximo QR')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/organizer/players/201')
  })

  it('renders completed summary duration as fixed terminal information', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      totals: { all: 1, active: 0, completed: 1 }, active: [], invalidated: [],
      ranking: [{ id: 301, participantId: 401, playerName: 'Ceci', identifierType: 'DNI', identifierSuffix: '123', rank: 1, isTied: false, score: 300, wrongCount: 0, hintsUsed: 0, durationSec: 577, needsReview: false }],
    }), { status: 200 })))
    render(<OrganizerView isEmbedded />)
    expect(await screen.findByText('FINALIZADO · 09:37 total')).toBeInTheDocument()
    expect(screen.queryByText(/FINALIZADO · 09:38/)).not.toBeInTheDocument()
  })
})
