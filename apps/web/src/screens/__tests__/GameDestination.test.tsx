import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameScreen } from '../GameScreen'
import * as client from '../../api/client'

vi.mock('../../api/client', () => ({
  getGameState: vi.fn(),
  getSupportStatus: vi.fn(),
  revealSecondaryHint: vi.fn(),
  submitFallbackCode: vi.fn(),
  submitSupport: vi.fn(),
  scanToken: vi.fn(),
  submitAnswer: vi.fn(),
  revealQuestionHint: vi.fn(),
  submitAnswerReview: vi.fn(),
  startSession: vi.fn(),
}))

const active = { state: 'ACTIVE' as const, clue: 'Pista vigente', stepNumber: 1, totalSteps: 5, playerName: 'Ada', score: 0 }

describe('next destination actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })))
    vi.mocked(client.getGameState).mockResolvedValue(active)
    vi.mocked(client.getSupportStatus).mockResolvedValue({ reviews: [], support: [] })
  })

  it('renders exactly one interactive light QR block inside the clue card and problem actions below it', async () => {
    render(<MemoryRouter><GameScreen /></MemoryRouter>)
    const scan = await screen.findByRole('button', { name: 'Escanear QR' })
    expect(screen.getAllByRole('button', { name: 'Escanear QR' })).toHaveLength(1)
    const card = screen.getByText('PISTA ACTIVA').closest('div.border-l-4')!
    expect(card).toContainElement(scan)
    const fallback = screen.getByRole('button', { name: 'No puedo escanear el QR' })
    const help = screen.getByRole('button', { name: '¿Necesitás ayuda?' })
    expect(card).not.toContainElement(fallback)
    expect(card).not.toContainElement(help)
    expect(scan.compareDocumentPosition(fallback) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('opens the scanner and gives a clean printed-code fallback when native detection is unavailable', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GameScreen /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Escanear QR' }))
    expect(screen.getByRole('dialog', { name: 'Escanear QR' })).toBeInTheDocument()
    expect(await screen.findByText(/escáner integrado no está disponible/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ingresar código impreso' }))
    expect(screen.getByText('¿No podés escanear el QR?')).toBeInTheDocument()
  })

  it('opens fallback from help without creating an alert and confirms damaged QR before sending', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><GameScreen /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: '¿Necesitás ayuda?' }))
    const help = screen.getByRole('heading', { name: '¿Necesitás ayuda?' }).closest('.fixed') as HTMLElement
    await user.click(within(help).getByRole('button', { name: 'No puedo escanear el QR' }))
    expect(client.submitSupport).not.toHaveBeenCalled()
    expect(screen.getByText('¿No podés escanear el QR?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: '¿Necesitás ayuda?' }))
    await user.click(screen.getByRole('button', { name: 'El QR está dañado, fue quitado o no funciona' }))
    expect(client.submitSupport).not.toHaveBeenCalled()
    expect(screen.getByText('Esto avisará a Tutorías que el QR está dañado, fue quitado o no funciona.')).toBeInTheDocument()
    vi.mocked(client.submitSupport).mockResolvedValue({ success: true, duplicate: true, message: 'Ya enviamos este aviso a Tutorías.' })
    await user.click(screen.getByRole('button', { name: 'Enviar aviso' }))
    await waitFor(() => expect(screen.getByText('Ya enviamos este aviso a Tutorías.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeEnabled()
  })

  it('updates game state after a correct answer instead of navigating to the same frozen route', async () => {
    const user = userEvent.setup()
    const challenge = { state: 'CHALLENGE' as const, challengeId: 7, question: 'Pregunta actual', stepNumber: 1, totalSteps: 5, playerName: 'Ada', score: 0 }
    const advanced = { state: 'ADVANCED' as const, clue: 'Destino siguiente', stepNumber: 2, totalSteps: 5, playerName: 'Ada', score: 100 }
    const recovered = { ...advanced, state: 'ACTIVE' as const }
    vi.mocked(client.getGameState).mockResolvedValueOnce(challenge).mockResolvedValue(recovered)
    vi.mocked(client.submitAnswer).mockResolvedValue(advanced)
    render(<MemoryRouter initialEntries={['/game']}><GameScreen /></MemoryRouter>)
    await user.click(await screen.findByText('Pregunta actual'))
    await user.type(screen.getByPlaceholderText('Tu respuesta'), 'correcta')
    await user.click(screen.getByRole('button', { name: 'Responder' }))
    expect(screen.getByText('¡Correcto!')).toBeInTheDocument()
    expect(await screen.findByText('Destino siguiente', {}, { timeout: 1_500 })).toBeInTheDocument()
    expect(screen.queryByText('¡Correcto!')).not.toBeInTheDocument()
  })
})
