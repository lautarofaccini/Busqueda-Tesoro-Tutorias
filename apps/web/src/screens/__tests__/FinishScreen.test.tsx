import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FinishScreen } from '../FinishScreen'
import * as client from '../../api/client'

vi.mock('../../api/client', () => ({ getGameState: vi.fn() }))

describe('FinishScreen', () => {
  beforeEach(() => vi.mocked(client.getGameState).mockResolvedValue({ state: 'COMPLETED', playerName: 'Ada', completedAt: '2026-09-21T17:00:00Z', score: 390 }))

  it('shows the concise saved-result and tie copy', async () => {
    render(<MemoryRouter><FinishScreen /></MemoryRouter>)
    expect(await screen.findByText('¡Terminaste!')).toBeInTheDocument()
    expect(screen.getByText('Puntaje final: 390')).toBeInTheDocument()
    expect(screen.getByText(/Tu resultado quedó guardado/)).toBeInTheDocument()
    expect(screen.getByText(/Si hay empate en puestos con premio/)).toBeInTheDocument()
    expect(screen.queryByText(/premios estarán disponibles/i)).not.toBeInTheDocument()
  })
})
