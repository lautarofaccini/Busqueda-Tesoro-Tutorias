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

  it('renders the main heading', () => {
    setup()
    expect(
      screen.getByRole('heading', { name: /búsqueda del tesoro/i })
    ).toBeInTheDocument()
  })

  it('shows the QR instruction', () => {
    setup()
    expect(
      screen.getByText(/buscá el QR de inicio en Tutorías/i)
    ).toBeInTheDocument()
  })

  it('does not show a demo badge', () => {
    setup()
    expect(
      screen.queryByRole('status', { name: /prototipo/i })
    ).not.toBeInTheDocument()
  })
})
