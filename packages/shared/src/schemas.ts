import { z } from 'zod'

// ── Player name ────────────────────────────────────────────────────────────
export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre no puede estar vacío.')
  .max(80, 'El nombre es demasiado largo.')

// ── Session start request ──────────────────────────────────────────────────
export const sessionStartRequestSchema = z.object({
  playerName: playerNameSchema,
  /** Token from the start checkpoint QR. */
  startToken: z.string().min(1),
})

export type SessionStartRequest = z.infer<typeof sessionStartRequestSchema>

// ── Checkpoint scan request ────────────────────────────────────────────────
export const checkpointScanRequestSchema = z.object({
  sessionId: z.string().min(1),
  token: z.string().min(1),
})

export type CheckpointScanRequest = z.infer<typeof checkpointScanRequestSchema>
