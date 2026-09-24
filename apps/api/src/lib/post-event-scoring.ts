export type PostEventScoreInput = {
  rawCorrectCount: number
  rawWrongCount: number
  hintCount: number
  pointsPerCorrect: number
  wrongAnswerPenalty: number
  hintPenalty: number
  manualAdjustmentTotal: number
}

export type PostEventScore = PostEventScoreInput & {
  baseScore: number
  finalScore: number
}

/** Reviews are evidence only. Explicit score_adjustments are the sole correction mechanism. */
export function calculatePostEventScore(input: PostEventScoreInput): PostEventScore {
  const baseScore = Math.max(0,
    input.rawCorrectCount * input.pointsPerCorrect
    - input.rawWrongCount * input.wrongAnswerPenalty
    - input.hintCount * input.hintPenalty,
  )
  return { ...input, baseScore, finalScore: Math.max(0, baseScore + input.manualAdjustmentTotal) }
}
