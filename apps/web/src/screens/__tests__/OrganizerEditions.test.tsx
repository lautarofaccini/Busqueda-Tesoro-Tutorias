import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrganizerView } from '../OrganizerView'

afterEach(() => vi.restoreAllMocks())

const analytics = (id: number, name: string, participants: number) => ({
  run: { id, name, effectiveStatus: 'ENDED', startedAt: '2026-09-23 14:00:00', endedAt: '2026-09-23 15:00:00' },
  totals: { all: participants, completed: participants, incomplete: 0, invalidated: 0, completionRate: 100 },
  ranking: [], active: [], incomplete: [], invalidated: [], careers: [], questions: [], checkpoints: [],
  globalPerformance: { sample: 0, averageCompletedScore: null, medianCompletedScore: null, averageWrongAnswers: 0, averageHints: 0, averageCompletionDurationSec: null, fastestCompletionSec: null },
  highlights: { mostParticipation: { value: 0, careers: [] }, mostTotalScore: { value: 0, careers: [] }, mostAverageScore: { value: 0, careers: [] } },
})

describe('historical edition selector', () => {
  it('distinguishes the current edition and loads a selected historical edition', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ runs: [
        { id: 2, name: 'Edición 2 — 24/09/2026', effectiveStatus: 'DRAFT', isCurrent: true },
        { id: 1, name: 'Edición 1 — 23/09/2026', effectiveStatus: 'ENDED', isCurrent: false },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(analytics(2, 'Edición 2 — 24/09/2026', 0)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ runs: [
        { id: 2, name: 'Edición 2 — 24/09/2026', effectiveStatus: 'DRAFT', isCurrent: true },
        { id: 1, name: 'Edición 1 — 23/09/2026', effectiveStatus: 'ENDED', isCurrent: false },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(analytics(1, 'Edición 1 — 23/09/2026', 3)), { status: 200 }))
    render(<OrganizerView isEmbedded />)
    const selector = await screen.findByRole('combobox', { name: 'Edición' })
    expect(screen.getByRole('option', { name: /Edición 2.*actual/ })).toBeInTheDocument()
    fireEvent.change(selector, { target: { value: '1' } })
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/organizer/runs/1/analytics'))
    expect(await screen.findByText('Edición 1 — 23/09/2026 · Finalizada')).toBeInTheDocument()
  })
})
