import { describe, expect, it } from 'vitest'
import { calculateReviewScoreCorrection } from '../routes/support.js'

describe('manual answer review score correction', () => {
  const settings = { points_per_correct: 100, wrong_answer_penalty: 10 }

  it('refunds the disputed wrong answer and awards a correct answer when approval completes the challenge', () => {
    expect(calculateReviewScoreCorrection({ status: 'APPROVED', awarded_correct: 1, reversed_wrong: 1 }, settings)).toBe(110)
  })

  it('only refunds the disputed wrong answer when the challenge was completed later', () => {
    expect(calculateReviewScoreCorrection({ status: 'APPROVED', awarded_correct: 0, reversed_wrong: 1 }, settings)).toBe(10)
  })

  it('does not change score for pending or rejected reviews', () => {
    expect(calculateReviewScoreCorrection({ status: 'PENDING', awarded_correct: 1, reversed_wrong: 1 }, settings)).toBe(0)
    expect(calculateReviewScoreCorrection({ status: 'REJECTED', awarded_correct: 1, reversed_wrong: 1 }, settings)).toBe(0)
  })
})
