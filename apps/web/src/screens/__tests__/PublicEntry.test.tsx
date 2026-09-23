import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PublicEntry } from '../PublicEntry'

describe('PublicEntry', () => {
  function setup() {
    return render(
      <MemoryRouter>
        <PublicEntry />
      </MemoryRouter>
    )
  }

  it('renders the main heading', async () => {
    setup()
    expect(
      await screen.findByRole('heading', { name: /búsqueda del tesoro/i })
    ).toBeInTheDocument()
  })

  it('shows the QR instruction', async () => {
    setup()
    expect(
      await screen.findByText(/buscá el QR de inicio en Tutorías/i)
    ).toBeInTheDocument()
  })

  it('does not show a demo badge', async () => {
    setup()
    await screen.findByRole('heading', { name: /búsqueda del tesoro/i })
    expect(
      screen.queryByRole('status', { name: /prototipo/i })
    ).not.toBeInTheDocument()
  })
})
