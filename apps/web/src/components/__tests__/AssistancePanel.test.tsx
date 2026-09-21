import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistancePanel } from '../AssistancePanel'

const items = [
  { id: 8, kind: 'SUPPORT', actionable: true, status: 'PENDING', category: 'QR_DAMAGED', created_at: '2026-09-21T17:24:00Z', display_name: 'Lautaro', label: 'Terraza', session_id: 4 },
  { id: 7, kind: 'ANSWER_REVIEW', actionable: true, status: 'PENDING', created_at: '2026-09-21T17:20:00Z', display_name: 'Ada', label: 'Biblioteca', session_id: 3, question_text: '¿Pregunta?', raw_answer: 'respuesta estudiante', canonical_answer: 'respuesta correcta', accepted_aliases: ['alias'], score_at_request: 80 },
] as const

describe('AssistancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn(async (_input, init) => init?.method === 'POST'
      ? new Response(JSON.stringify({ success: true }), { status: 200 })
      : new Response(JSON.stringify({ pendingCount: 2, items }), { status: 200 })) as typeof fetch
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
})
