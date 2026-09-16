export const SCORING_CONFIG = {
  POINTS_PER_CORRECT: 100,
  PENALTY_WRONG: 10,
  PENALTY_HINT: 20, // Not yet implemented, but here conceptually
}

export function calculateScore(correctCount: number, wrongCount: number, hintCount: number = 0): number {
  const score = (correctCount * SCORING_CONFIG.POINTS_PER_CORRECT)
              - (wrongCount * SCORING_CONFIG.PENALTY_WRONG)
              - (hintCount * SCORING_CONFIG.PENALTY_HINT);
  
  return Math.max(0, score);
}
