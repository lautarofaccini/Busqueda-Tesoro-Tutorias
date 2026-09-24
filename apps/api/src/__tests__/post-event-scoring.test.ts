import { describe, expect, it } from 'vitest'
import { calculatePostEventScore } from '../lib/post-event-scoring.js'
import { getRunAnalytics } from '../lib/analytics.js'

const ema = {
  rawCorrectCount: 5,
  rawWrongCount: 14,
  hintCount: 3,
  pointsPerCorrect: 100,
  wrongAnswerPenalty: 10,
  hintPenalty: 5,
}

function analyticsDb(sessionRows: any[]) {
  const run = {
    id: 1, name: 'Edición 1', status: 'ENDED', createdAt: '2026-09-23 13:00:00',
    startedAt: '2026-09-23 14:00:00', closingAt: null, endedAt: '2026-09-23 16:00:00',
    pointsPerCorrect: 100, wrongAnswerPenalty: 10, hintPenalty: 5,
  }
  return {
    prepare(sql: string) {
      const statement = {
        bind: () => statement,
        first: async () => sql.includes('FROM event_runs WHERE id') ? run : null,
        all: async () => ({ results: sql.includes('adjustments AS') ? sessionRows : [] }),
      }
      return statement
    },
  } as unknown as D1Database
}

function player(overrides: Record<string, unknown>) {
  return {
    id: 1, participantId: 1, playerName: 'Ema', career: 'IEM', identifierType: 'DNI', identifierSuffix: '001',
    status: 'completed', currentStep: 5, unlockedStep: null, startedAt: '2026-09-23 14:00:00',
    completedAt: '2026-09-23 15:00:00', invalidatedAt: null, invalidationReason: null,
    auditReviewedAt: null, auditReviewedBy: null, correctCount: 5, wrongCount: 14, hintsUsed: 3,
    totalSteps: 5, pendingReview: 0, approvedReviewCount: 3,
    manualCorrect: 3, reversedWrong: 3, manualAdjustmentTotal: 0, manualAdjustmentCount: 0,
    ...overrides,
  }
}

describe('manual-only post-event scoring', () => {
  it('keeps the Ema regression baseline at 345 regardless of three approved reviews', () => {
    expect(calculatePostEventScore({ ...ema, manualAdjustmentTotal: 0 })).toMatchObject({
      rawCorrectCount: 5, rawWrongCount: 14, hintCount: 3, baseScore: 345,
      manualAdjustmentTotal: 0, finalScore: 345,
    })
    expect(calculatePostEventScore({ ...ema, manualAdjustmentTotal: 10 }).finalScore).toBe(355)
    expect(calculatePostEventScore({ ...ema, manualAdjustmentTotal: 20 }).finalScore).toBe(365)
  })

  it.each([
    [10, 355], [5, 350], [-10, 335], [-5, 340],
  ])('applies the explicit manual adjustment %i only', (manualAdjustmentTotal, expected) => {
    expect(calculatePostEventScore({ ...ema, manualAdjustmentTotal }).finalScore).toBe(expected)
  })

  it('applies the zero floor before and after manual adjustments', () => {
    const zeroBase = { ...ema, rawCorrectCount: 0, rawWrongCount: 1, hintCount: 0 }
    expect(calculatePostEventScore({ ...zeroBase, manualAdjustmentTotal: -5 })).toMatchObject({ baseScore: 0, finalScore: 0 })
    expect(calculatePostEventScore({ ...zeroBase, manualAdjustmentTotal: 5 })).toMatchObject({ baseScore: 0, finalScore: 5 })
  })

  it('keeps approved reviews out of ranking and aggregates, while manual adjustments update them', async () => {
    const playerB = player({ id: 2, participantId: 2, playerName: 'Player B', career: 'ISI', correctCount: 6, wrongCount: 0, hintsUsed: 0, approvedReviewCount: 0 })
    const withoutReviews = await getRunAnalytics(analyticsDb([player({ approvedReviewCount: 0, manualCorrect: 0, reversedWrong: 0 }), playerB]), 1)
    const withReviews = await getRunAnalytics(analyticsDb([player({ approvedReviewCount: 3, manualCorrect: 3, reversedWrong: 3 }), playerB]), 1)

    expect(withReviews?.ranking.map(item => [item.playerName, item.score, item.wrongCount])).toEqual([
      ['Player B', 600, 0], ['Ema', 345, 14],
    ])
    expect(withReviews?.careers.find(item => item.career === 'IEM')).toMatchObject({ totalScore: 345, averageScore: 345 })
    expect(withReviews?.globalPerformance).toMatchObject({ averageCompletedScore: 472.5, medianCompletedScore: 472.5 })
    expect(withReviews?.ranking.map(item => item.score)).toEqual(withoutReviews?.ranking.map(item => item.score))
    expect(withReviews?.careers.map(item => item.totalScore)).toEqual(withoutReviews?.careers.map(item => item.totalScore))
    expect(withReviews?.globalPerformance).toEqual(withoutReviews?.globalPerformance)

    const manuallyAdjusted = await getRunAnalytics(analyticsDb([player({ manualAdjustmentTotal: 10, manualAdjustmentCount: 1 }), playerB]), 1)
    expect(manuallyAdjusted?.ranking.map(item => [item.playerName, item.score])).toEqual([['Player B', 600], ['Ema', 355]])
    expect(manuallyAdjusted?.careers.find(item => item.career === 'IEM')).toMatchObject({ totalScore: 355, averageScore: 355 })
    expect(manuallyAdjusted?.globalPerformance).toMatchObject({ averageCompletedScore: 477.5, medianCompletedScore: 477.5 })
  })

  it('keeps score ties tied without using duration', async () => {
    const tied = await getRunAnalytics(analyticsDb([
      player({ id: 2, participantId: 2, playerName: 'Player B', career: 'ISI', correctCount: 6, wrongCount: 0, hintsUsed: 0, approvedReviewCount: 0 }),
      player({ id: 3, participantId: 3, playerName: 'Player C', career: 'IQ', correctCount: 6, wrongCount: 0, hintsUsed: 0, approvedReviewCount: 0, completedAt: '2026-09-23 14:10:00' }),
    ]), 1)
    expect(tied?.ranking.map(item => ({ rank: item.rank, tied: item.isTied }))).toEqual([
      { rank: 1, tied: true }, { rank: 1, tied: true },
    ])
  })
})
