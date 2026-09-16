import { z } from 'zod'

// ── Player name ─────────────────────────────────────────────────────────────
export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre no puede estar vacío.')
  .max(80, 'El nombre es demasiado largo.')

// ── Session start request ────────────────────────────────────────────────────
// Requires the start token so the server can verify the player
// actually reached the physical Tutorías start QR.
export const sessionStartSchema = z.object({
  playerName: playerNameSchema,
  /** Opaque token from the start checkpoint QR. Server validates this. */
  startToken: z.string().min(1),
})

export type SessionStartRequest = z.infer<typeof sessionStartSchema>

// ── Answer submit request ────────────────────────────────────────────────────
export const answerSubmitSchema = z.object({
  /** Raw answer as typed by the player. Server normalizes before comparison. */
  answer: z.string().min(1, 'La respuesta no puede estar vacía.').max(200),
})

export type AnswerSubmitRequest = z.infer<typeof answerSubmitSchema>
