/**
 * buildGameState — constructs the current GameState from a session row.
 *
 * Used by:
 *   GET /api/game/state
 *   POST /api/scan/:token (after unlock)
 *   POST /api/session/start (initial state)
 *
 * State machine:
 *   unlocked_step = current_step → CHALLENGE (player scanned checkpoint, challenge active)
 *   unlocked_step = NULL         → ACTIVE (player travelling to next checkpoint)
 *   status = 'completed'         → COMPLETED
 *
 * Security: accepted_answers NEVER included in any response.
 */
import type { GameState } from '@busqueda-tesoro/shared'
import type { SessionRow } from '../db/queries.js'
import {
  getAssignedChallenge,
  getSessionStep,
  getSessionTotalSteps,
  hasUsedHint,
  hasUsedQuestionHint,
  getSessionScore,
} from '../db/queries.js'

export async function buildGameState(
  db: D1Database,
  session: SessionRow
): Promise<GameState> {
  if (session.status === 'completed') {
    return {
      state: 'COMPLETED',
      playerName: session.player_name,
      completedAt: session.completed_at ?? new Date().toISOString(),
    }
  }

  const totalSteps = await getSessionTotalSteps(db, session.id)
  const score = await getSessionScore(db, session.id)

  // Challenge is active when unlocked_step equals current_step.
  if (session.unlocked_step === session.current_step) {
    const step = await getSessionStep(db, session.id, session.current_step)
    if (!step) return { state: 'NEEDS_START' }

    const challenge = await getAssignedChallenge(db, session.id, session.current_step)
    if (!challenge) return { state: 'NEEDS_START' }

    const usedHint = await hasUsedQuestionHint(db, session.id, challenge.id)
    // Check if they have at least one wrong answer for this challenge
    const wrongCountRes = await db.prepare('SELECT count(*) as c FROM answer_attempts WHERE session_id = ? AND challenge_id = ? AND correct = 0').bind(session.id, challenge.id).first();
    const hasWrong = (wrongCountRes?.c as number) > 0;
    // Cooldown logic: check if the LAST attempt was wrong and less than 10s ago
    let cooldownRemaining = 0;
    const lastAttempt = await db.prepare('SELECT correct, attempted_at FROM answer_attempts WHERE session_id = ? AND challenge_id = ? ORDER BY id DESC LIMIT 1').bind(session.id, challenge.id).first();
    if (lastAttempt && lastAttempt.correct === 0) {
      const msSince = Date.now() - new Date(lastAttempt.attempted_at as string).getTime();
      if (msSince < 10000) {
        cooldownRemaining = Math.ceil((10000 - msSince) / 1000);
      }
    }

    return {
      state: 'CHALLENGE',
      challengeId: challenge.id,
      question: challenge.question_text,
      stepNumber: session.current_step,
      totalSteps,
      playerName: session.player_name,
      score,
      hasHint: !!challenge.hint_text && hasWrong && !usedHint,
      ...(usedHint ? { hint: challenge.hint_text } : {}),
      ...(cooldownRemaining > 0 ? { cooldownRemaining } : {}),
    }

  }

  // Player is travelling to next checkpoint — return the clue.
  const step = await getSessionStep(db, session.id, session.current_step)
  if (!step) return { state: 'NEEDS_START' }

  const usedHint = await hasUsedHint(db, session.id, session.current_step)

  return {
    state: 'ACTIVE',
    clue: step.primary_clue,
    ...(usedHint ? { secondaryClue: step.secondary_clue } : {}),
    hasSecondaryClue: !!step.secondary_clue && !usedHint,
    instruction: step.instruction,
    stepNumber: session.current_step,
    totalSteps,
    playerName: session.player_name,
    score,
  }
}
