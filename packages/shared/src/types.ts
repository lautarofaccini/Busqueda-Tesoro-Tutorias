// Shared domain types — busqueda-tesoro-tutorias.
// Phase 1: discriminated GameState union + supporting types.

/** Opaque token embedded in each physical QR code. Never exposed to clients. */
export type CheckpointToken = string & { readonly _brand: 'CheckpointToken' }

/** A player's display name, collected at game start. */
export type PlayerName = string & { readonly _brand: 'PlayerName' }

/** Server-authoritative closing grace period metadata. */
export interface ClosingGraceInfo {
  deadline: string
  remainingSeconds: number
}

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
  closing?: ClosingGraceInfo
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
  closing?: ClosingGraceInfo
  // NOTE: accepted answers are NEVER included here — server side only.
}

/** Player scanned a QR that does not match the expected next checkpoint. */
export interface StateWrongCheckpoint {
  state: 'WRONG_CHECKPOINT'
  closing?: ClosingGraceInfo
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
  closing?: ClosingGraceInfo
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
  closing?: ClosingGraceInfo
}

/** All steps completed. */
export interface StateCompleted {
  state: 'COMPLETED'
  playerName: string
  completedAt: string
  score: number
}

/** Event is currently paused by organizers. Gameplay blocked. */
export interface StateEventPaused {
  state: 'EVENT_PAUSED'
}

/** Event is ended. Gameplay blocked. */
export interface StateEventEnded {
  state: 'EVENT_ENDED'
}

/** Registrations are closed and this browser has no existing session. */
export interface StateRegistrationClosed {
  state: 'REGISTRATION_CLOSED'
}

/** The closing grace period elapsed for an unfinished session. */
export interface StateClosingExpired {
  state: 'CLOSING_EXPIRED'
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
  | StateRegistrationClosed
  | StateClosingExpired
