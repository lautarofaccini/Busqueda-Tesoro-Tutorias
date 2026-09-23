import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PublicEntry } from '../PublicEntry'
import * as client from '../../api/client'

vi.mock('../../api/client', async importOriginal => {
  const actual = await importOriginal<typeof import('../../api/client')>()
  return { ...actual, getGameState: vi.fn(), submitFallbackCode: vi.fn() }
})

describe('PublicEntry during closing', () => {
  it('clearly blocks registration when there is no session', async () => {
    vi.mocked(client.getGameState).mockResolvedValue({ state: 'REGISTRATION_CLOSED' })
    render(<MemoryRouter><PublicEntry /></MemoryRouter>)
    expect(await screen.findByText('Las inscripciones ya cerraron.')).toBeInTheDocument()
  })
})
