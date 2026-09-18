// Shared domain types — busqueda-tesoro-tutorias.
// Phase 1: discriminated GameState union + supporting types.

/** Opaque token embedded in each physical QR code. Never exposed to clients. */
export type CheckpointToken = string & { readonly _brand: 'CheckpointToken' }

/** A player's display name, collected at game start. */
export type PlayerName = string & { readonly _brand: 'PlayerName' }

// ── Discriminated GameState union ─────────────────────────────────────────
// Returned by GET /api/game/state and POST /api/scan/:token.
// Each variant carries only what the client is allowed to see.

/** No active session. Player must find the start QR. */
export interface StateNeedsStart {
  state: 'NEEDS_START'
}

/** Token belongs to the start checkpoint. Player may enter their name. */
export interface StateStartAllowed {
  state: 'START_ALLOWED'
  /** Echo the start token so the client can include it in the session/start POST. */
  startToken: string
}

/** Session active; player is travelling to the next checkpoint. */
export interface StateActive {
  score: number
  secondaryClue?: string | null
  hasSecondaryClue?: boolean
  instruction?: string | null
  state: 'ACTIVE'
  /** Clue text for the current step. Safe to show. */
  clue: string
  stepNumber: number
  totalSteps: number
  playerName: string
}

/**
 * Player has scanned the correct checkpoint.
 * Challenge is now unlocked. No answers included.
 */
export interface StateChallenge {
  score: number
  state: 'CHALLENGE'
  challengeId: number
  question: string
  stepNumber: number
  totalSteps: number
  playerName: string
  hasHint?: boolean
  hint?: string | null
  cooldownRemaining?: number
  // NOTE: accepted answers are NEVER included here — server side only.
}

/** Player scanned a QR that does not match the expected next checkpoint. */
export interface StateWrongCheckpoint {
  state: 'WRONG_CHECKPOINT'
  // No checkpoint details — reveals nothing about where they are.
}

/** Player submitted a wrong answer. */
export interface StateAnswerIncorrect {
  score: number
  state: 'ANSWER_INCORRECT'
  challengeId: number
  question: string
  stepNumber: number
  totalSteps: number
  playerName: string
  hasHint?: boolean
  hint?: string | null
  cooldownRemaining?: number
  attemptId?: number
}

/** Correct answer; route advanced. Contains the next clue. */
export interface StateAdvanced {
  score: number
  secondaryClue?: string | null
  hasSecondaryClue?: boolean
  instruction?: string | null
  state: 'ADVANCED'
  clue: string
  stepNumber: number
  totalSteps: number
  playerName: string
}

/** All steps completed. */
export interface StateCompleted {
  state: 'COMPLETED'
  playerName: string
  completedAt: string
}

/** Event is currently paused by organizers. Gameplay blocked. */
export interface StateEventPaused {
  state: 'EVENT_PAUSED'
}

/** Event is ended. Gameplay blocked. */
export interface StateEventEnded {
  state: 'EVENT_ENDED'
}

/** Union of all possible game states. */
export type GameState =
  | StateNeedsStart
  | StateStartAllowed
  | StateActive
  | StateChallenge
  | StateWrongCheckpoint
  | StateAnswerIncorrect
  | StateAdvanced
  | StateCompleted
  | StateEventPaused
  | StateEventEnded
