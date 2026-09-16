import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { DemoStart } from '../DemoStart'

describe('DemoStart', () => {
  function setup() {
    return render(
      <MemoryRouter>
        <DemoStart />
      </MemoryRouter>
    )
  }

  it('renders the player name input', () => {
    setup()
    expect(screen.getByLabelText(/tu nombre/i)).toBeInTheDocument()
  })

  it('renders the start button as disabled when name is empty', () => {
    setup()
    expect(screen.getByRole('button', { name: /comenzar/i })).toBeDisabled()
  })

  it('enables the start button when name and identifier are typed', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText(/tu nombre/i), 'Ana García')
    await user.type(screen.getByPlaceholderText(/número de legajo/i), '12345')
    expect(screen.getByRole('button', { name: /comenzar/i })).not.toBeDisabled()
  })

  it('shows the demo badge', () => {
    setup()
    expect(
      screen.getByRole('status', { name: /prototipo/i })
    ).toBeInTheDocument()
  })
})
