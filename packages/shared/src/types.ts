// Shared domain types for busqueda-tesoro-tutorias.
// Phase 0: minimal set. Grows with each implementation phase.

/** Opaque token embedded in each physical QR code. Never exposed to clients. */
export type CheckpointToken = string & { readonly _brand: 'CheckpointToken' }

/** A player's display name, collected at game start. */
export type PlayerName = string & { readonly _brand: 'PlayerName' }

/**
 * Possible outcomes when a session scans a checkpoint token.
 *
 * - no_session  : No active game session exists.
 * - wrong_order : Session exists but this is not the expected checkpoint.
 * - correct     : Session exists and this is the correct next checkpoint.
 */
export type CheckpointScanResult = 'no_session' | 'wrong_order' | 'correct'
