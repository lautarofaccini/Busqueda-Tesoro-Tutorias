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
  identifierType: z.enum(['LEGAJO', 'DNI']),
  identifierValue: z.string().min(1, 'La identificación no puede estar vacía.'),
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

// ── Admin Event Settings ──────────────────────────────────────────────────
export const eventSettingsSchema = z.object({
  status: z.enum(['DRAFT', 'LIVE', 'PAUSED', 'ENDED']),
  event_name: z.string().min(1),
  points_per_correct: z.number().int().min(0),
  wrong_answer_penalty: z.number().int().min(0),
  hint_penalty: z.number().int().min(0),
  minimum_expected_completion_minutes: z.number().int().min(0),
})
export type EventSettingsDto = z.infer<typeof eventSettingsSchema>

// ── Admin Checkpoints ─────────────────────────────────────────────────────
export const checkpointSchema = z.object({
  label: z.string().min(1),
  active: z.number().int().min(0).max(1),
  is_start: z.number().int().min(0).max(1),
})
export type CheckpointDto = z.infer<typeof checkpointSchema>

// ── Admin Challenges ──────────────────────────────────────────────────────
export const challengeSchema = z.object({
  checkpoint_id: z.number().int(),
  question_text: z.string().min(1),
  accepted_answers: z.array(z.string().min(1)).min(1),
  hint_text: z.string().nullable(),
  active: z.number().int().min(0).max(1),
})
export type ChallengeDto = z.infer<typeof challengeSchema>

// ── Admin Routes ──────────────────────────────────────────────────────────
export const routeStepSchema = z.object({
  position: z.number().int().min(1),
  checkpoint_id: z.number().int(),
  clue_text: z.string().min(1),
})
export const routeSchema = z.object({
  name: z.string().min(1),
  active: z.number().int().min(0).max(1),
  steps: z.array(routeStepSchema)
})
export type RouteDto = z.infer<typeof routeSchema>
