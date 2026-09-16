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

  // Challenge is active when unlocked_step equals current_step.
  if (session.unlocked_step === session.current_step) {
    const step = await getSessionStep(db, session.id, session.current_step)
    if (!step) return { state: 'NEEDS_START' }

    const challenge = await getAssignedChallenge(db, session.id, session.current_step)
    if (!challenge) return { state: 'NEEDS_START' }

    return {
      state: 'CHALLENGE',
      challengeId: challenge.id,
      question: challenge.question_text,
      // accepted_answers deliberately NOT included
      stepNumber: session.current_step,
      totalSteps,
      playerName: session.player_name,
    }
  }

  // Player is travelling to next checkpoint — return the clue.
  const step = await getSessionStep(db, session.id, session.current_step)
  if (!step) return { state: 'NEEDS_START' }

  return {
    state: 'ACTIVE',
    clue: step.clue_text,
    stepNumber: session.current_step,
    totalSteps,
    playerName: session.player_name,
  }
}
