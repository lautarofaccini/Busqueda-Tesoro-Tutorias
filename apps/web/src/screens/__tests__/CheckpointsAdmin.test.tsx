import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckpointsAdmin } from '../AdminView'

const checkpoints = [
  { id: 11, label: 'Checkpoint A', token: 'token-a', active: 1, is_start: 0, instruction: null, primary_clue: 'Pista A', secondary_clue: null },
  { id: 22, label: 'Checkpoint B', token: 'token-b', active: 1, is_start: 0, instruction: null, primary_clue: 'Pista B', secondary_clue: null },
]

function mockFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/admin/checkpoints') return new Response(JSON.stringify(checkpoints), { status: 200 })
    if (url === '/api/admin/challenges') return new Response(JSON.stringify([]), { status: 200 })
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }) as typeof fetch
}

function mockFetchWithChallenge() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/admin/checkpoints') return new Response(JSON.stringify(checkpoints), { status: 200 })
    if (url === '/api/admin/challenges') return new Response(JSON.stringify([{ id: 70, checkpoint_id: 11, question_text: 'Pregunta existente', accepted_answers: ['respuesta'], hint_text: 'Pista existente', active: 1, needs_review: 0, review_note: null }]), { status: 200 })
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }) as typeof fetch
}

async function setup() {
  const user = userEvent.setup()
  render(<CheckpointsAdmin />)
  await screen.findByText('Checkpoint A')
  return user
}

describe('CheckpointsAdmin accordion and QR actions', () => {
  beforeEach(() => {
    mockFetch()
    vi.stubGlobal('confirm', vi.fn(() => false))
  })

  it('opens A, closes A, and repeatedly toggles it', async () => {
    const user = await setup()
    await user.click(screen.getByText('Checkpoint A'))
    expect(screen.getByText('Detalles y Pistas')).toBeInTheDocument()
    await user.click(screen.getByText('Checkpoint A'))
    expect(screen.queryByText('Detalles y Pistas')).not.toBeInTheDocument()
    await user.click(screen.getByText('Checkpoint A'))
    expect(screen.getByText('Detalles y Pistas')).toBeInTheDocument()
  })

  it('opens B while closing A', async () => {
    const user = await setup()
    await user.click(screen.getByText('Checkpoint A'))
    await user.click(screen.getByText('Checkpoint B'))
    expect(screen.getByText('Pista B')).toBeInTheDocument()
    expect(screen.queryByText('Pista A')).not.toBeInTheDocument()
  })

  it('header action buttons do not toggle the accordion', async () => {
    const user = await setup()
    await user.click(screen.getAllByText('Desactivar')[0]!)
    expect(screen.queryByText('Detalles y Pistas')).not.toBeInTheDocument()
  })

  it('saving details keeps the controlled accordion usable', async () => {
    const user = await setup()
    await user.click(screen.getByText('Checkpoint A'))
    await user.click(screen.getByText('Editar Detalles'))
    await user.click(screen.getByText('Guardar Detalles'))
    await waitFor(() => expect(screen.getByText('Detalles y Pistas')).toBeInTheDocument())
    await user.click(screen.getByText('Checkpoint A'))
    expect(screen.queryByText('Detalles y Pistas')).not.toBeInTheDocument()
  })

  it('views the current QR without regenerating its token', async () => {
    const user = await setup()
    await user.click(screen.getAllByText('Ver QR')[0]!)
    const image = screen.getByAltText('Código QR de Checkpoint A') as HTMLImageElement
    expect(image.src).toContain(encodeURIComponent('https://tesoro.tutorias-frre.workers.dev/q/token-a'))
    expect(global.fetch).not.toHaveBeenCalledWith('/api/admin/checkpoints/11/token', expect.anything())
    expect(screen.getAllByText('Descargar QR').length).toBeGreaterThan(0)
  })

  it('keeps destructive regeneration separate from viewing QR', async () => {
    const user = await setup()
    expect(screen.getAllByText('Regenerar QR')).toHaveLength(2)
    await user.click(screen.getAllByText('Regenerar QR')[0]!)
    expect(global.fetch).not.toHaveBeenCalledWith('/api/admin/checkpoints/11/token', expect.anything())
  })

  it('renders and preserves the existing question hint without showing a raw zero', async () => {
    mockFetchWithChallenge()
    const user = userEvent.setup()
    render(<CheckpointsAdmin />)
    await user.click(await screen.findByText('Checkpoint A'))
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByDisplayValue('Pista existente')).toBeInTheDocument()
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    const request = vi.mocked(global.fetch).mock.calls.find(([url, options]) => String(url) === '/api/admin/challenges/70' && options?.method === 'PUT')
    expect(request).toBeDefined()
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ hint_text: 'Pista existente', needs_review: 0 })
  })
})
