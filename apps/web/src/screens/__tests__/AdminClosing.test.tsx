import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventSettings } from '../AdminView'

const live = {
  status: 'LIVE', effectiveStatus: 'LIVE', event_name: 'Evento', points_per_correct: 100,
  wrong_answer_penalty: 10, hint_penalty: 5, minimum_expected_completion_minutes: 10,
  activeSessions: 3, closingDeadline: null, closingRemainingSeconds: 0,
}

afterEach(() => vi.restoreAllMocks())

describe('admin closing controls', () => {
  it('uses an explicit confirmation and shows the authoritative grace countdown', async () => {
    const closing = { ...live, status: 'CLOSING', effectiveStatus: 'CLOSING', closingDeadline: '2026-09-23T18:30:00.000Z', closingRemainingSeconds: 1 }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(closing), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    render(<EventSettings initialData={live} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar inscripciones' }))
    expect(screen.getByText(/Los jugadores actuales tendrán 30 minutos para terminar/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    await waitFor(() => expect(screen.getByText(/CIERRE EN CURSO — solo jugadores actuales/)).toBeInTheDocument())
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(sent.status).toBe('CLOSING')
    expect(screen.getByText('0:01', { selector: 'dd' })).toBeInTheDocument()
  })

  it('warns before an immediate hard stop when active players exist', () => {
    render(<EventSettings initialData={live} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar ahora' }))
    expect(screen.getByText('Esto detendrá el juego inmediatamente.')).toBeInTheDocument()
    expect(screen.getByText(/Hay 3 jugadores activos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar finalización inmediata' })).toBeInTheDocument()
  })
})
