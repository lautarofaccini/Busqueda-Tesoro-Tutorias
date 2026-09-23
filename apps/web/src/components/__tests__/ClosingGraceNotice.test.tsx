import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClosingGraceNotice } from '../ClosingGraceNotice'

afterEach(() => vi.useRealTimers())

describe('ClosingGraceNotice', () => {
  it('counts down locally from the server-provided remaining time without polling', () => {
    vi.useFakeTimers()
    render(<ClosingGraceNotice closing={{ deadline: '2026-09-23T18:30:00.000Z', remainingSeconds: 2 }} />)
    expect(screen.getByText('Tenés 0:02 para terminar tu recorrido.')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1_000))
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText('El tiempo para finalizar terminó.')).toBeInTheDocument()
  })
})
