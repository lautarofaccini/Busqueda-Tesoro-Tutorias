/**
 * POST /api/session/start
 *
 * Creates a new game session after the player submits their name
 * from the start QR page.
 *
 * Security:
 *   startToken must match a checkpoint with is_start=1 in the DB.
 *   Arbitrary POSTs without a valid start token are rejected (400).
 *   Session token is a server-generated crypto UUID — never derived from input.
 *   Session token is set as an HttpOnly cookie, never in the response body.
 *
 * On success:
 *   Returns ACTIVE state with the first clue.
 *   current_step = 0 → Tutorías start challenge is active.
 *   current_step >= 1 → persisted randomized destination steps.
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { sessionStartSchema } from '@busqueda-tesoro/shared'
import type { Env } from '../env.d'
import {
  getCheckpointByToken,
  createSession,
  cleanupFailedSessionStart,
  logScanEvent,
  getEventSettings,
  findParticipant,
  createParticipant,
  getAssignedChallenge,
  getRandomActiveChallengeForCheckpoint,
  assignChallenge,
  getSessionTotalSteps
} from '../db/queries.js'
import { buildSessionCookie } from '../lib/cookies.js'
import { buildGameState } from '../lib/game-state.js'

const sessionRoutes = new Hono<{ Bindings: Env }>()

sessionRoutes.post(
  '/start',
  zValidator('json', sessionStartSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: 'VALIDATION_ERROR', issues: result.error.issues }, 400)
    }
  }),
  async (c) => {
    const { playerName, lastName, career, identifierType, identifierValue, startToken } = c.req.valid('json')
    
    // Check event lifecycle
    const settings = await getEventSettings(c.env.DB)
    if (!settings || settings.status !== 'LIVE') {
      return c.json({ error: 'EVENT_NOT_LIVE', status: settings?.status || 'DRAFT' }, 403)
    }

    // Verify the token is the start checkpoint
    const checkpoint = await getCheckpointByToken(c.env.DB, startToken)
    if (!checkpoint || checkpoint.is_start !== 1) {
      await logScanEvent(c.env.DB, {
        sessionId: null,
        checkpointId: checkpoint?.id ?? null,
        rawToken: startToken,
        outcome: 'INVALID_START_TOKEN',
      })
      return c.json({ error: 'INVALID_START_TOKEN' }, 400)
    }

    // Normalize and hash identifier
    const normalizedId = identifierValue.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    if (!normalizedId) return c.json({ error: 'INVALID_IDENTIFIER' }, 400)
    
    const encoder = new TextEncoder()
    const keyData = encoder.encode(c.env.PARTICIPANT_ID_SECRET)
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const hashBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(normalizedId))
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const identifierHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    const identifierSuffix = normalizedId.slice(-3).padStart(3, '*')

    let participant = await findParticipant(c.env.DB, identifierType, identifierHash)
    let newlyCreatedParticipantId: number | null = null
    if (participant) {
      if (participant.invalidated_at) {
        return c.json({ error: 'IDENTIFIER_RELEASE_REQUIRED' }, 403)
      } else {
        // Check if they have an active session
        const existingSessionRes = await c.env.DB.prepare('SELECT id FROM sessions WHERE participant_id = ? AND status != \'abandoned\'').bind(participant.id).first()
        if (existingSessionRes) {
          return c.json({ error: 'DUPLICATE_PARTICIPATION' }, 403)
        }
      }
    } else {
      const pId = await createParticipant(c.env.DB, {
        displayName: playerName.trim(),
          lastName: lastName.trim(),
          career: career.trim(),
        identifierType,
        identifierHash,
        identifierSuffix
      })
      participant = { id: pId }
      newlyCreatedParticipantId = pId
    }

    const sessionToken = crypto.randomUUID()
    let sessionId: number | null = null
    try {
      sessionId = await createSession(c.env.DB, {
        sessionToken,
        playerName: `${playerName.trim()} ${lastName.trim()}`,
        participantId: participant.id,
      })

      if (await getSessionTotalSteps(c.env.DB, sessionId) === 0) {
        throw new Error('SESSION_INITIALIZATION_NO_DESTINATIONS')
      }

      // Tutorías is a start-only challenge. Position 0 is intentionally
      // outside session_steps, whose positions 1..N are destinations.
      let challenge = await getAssignedChallenge(c.env.DB, sessionId, 0)
      if (!challenge) {
        const randomChallenge = await getRandomActiveChallengeForCheckpoint(c.env.DB, checkpoint.id)
        if (!randomChallenge) {
          throw new Error('SESSION_INITIALIZATION_NO_START_CHALLENGE')
        }
        await assignChallenge(c.env.DB, sessionId, 0, randomChallenge.id)
      }

      const session = {
        id: sessionId,
        session_token: sessionToken,
        player_name: playerName.trim(),
        current_step: 0,
        status: 'active',
        unlocked_step: 0,
        started_at: new Date().toISOString(),
        completed_at: null,
      }
      const state = await buildGameState(c.env.DB, session)
      if (state.state !== 'CHALLENGE') {
        throw new Error('SESSION_INITIALIZATION_INVALID_INITIAL_STATE')
      }

      await logScanEvent(c.env.DB, {
        sessionId,
        checkpointId: checkpoint.id,
        rawToken: startToken,
        outcome: 'SESSION_STARTED',
      })

      const secure = c.env.ENVIRONMENT === 'production'
      c.header('Set-Cookie', buildSessionCookie(sessionToken, secure))
      return c.json(state, 201)
    } catch (error) {
      // Do not include identifier values, HMACs, secrets, or D1 error text in
      // the response. The stable diagnostic code is sufficient for logs.
      console.error('session initialization failed', {
        code: error instanceof Error ? error.message : 'UNKNOWN',
        sessionId,
        participantCreated: newlyCreatedParticipantId !== null,
      })
      try {
        await cleanupFailedSessionStart(c.env.DB, sessionId, newlyCreatedParticipantId)
      } catch (cleanupError) {
        console.error('session initialization cleanup failed', {
          code: cleanupError instanceof Error ? cleanupError.message : 'UNKNOWN',
          sessionId,
        })
      }
      return c.json({ error: 'SESSION_INITIALIZATION_FAILED' }, 500)
    }
  }
)

export { sessionRoutes }
