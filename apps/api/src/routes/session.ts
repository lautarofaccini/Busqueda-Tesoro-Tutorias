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
 *   current_step = 1 → player is seeking Demo Checkpoint A.
 *   unlocked_step = NULL → challenge not yet active.
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { sessionStartSchema } from '@busqueda-tesoro/shared'
import type { Env } from '../env.d'
import {
  getCheckpointByToken,
  getRandomActiveRoute,
  createSession,
  logScanEvent,
  getEventSettings,
} from '../db/queries.js'
import { buildSessionCookie, isLocalRequest } from '../lib/cookies.js'
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
    const { playerName, startToken } = c.req.valid('json')
    
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

    const route = await getRandomActiveRoute(c.env.DB)
    if (!route) {
      return c.json({ error: 'NO_ROUTE_CONFIGURED' }, 500)
    }

    const sessionToken = crypto.randomUUID()
    const sessionId = await createSession(c.env.DB, {
      sessionToken,
      playerName: playerName.trim(),
      routeId: route.id,
    })

    await logScanEvent(c.env.DB, {
      sessionId,
      checkpointId: checkpoint.id,
      rawToken: startToken,
      outcome: 'SESSION_STARTED',
    })

    const secure = !isLocalRequest(c.req.url)
    c.header('Set-Cookie', buildSessionCookie(sessionToken, secure))

    // Build initial game state from a minimal session object
    // current_step = 1, unlocked_step = null → ACTIVE with first clue
    const session = {
      id: sessionId,
      session_token: sessionToken,
      player_name: playerName.trim(),
      route_id: route.id,
      current_step: 1,
      status: 'active',
      unlocked_step: null,
      started_at: new Date().toISOString(),
      completed_at: null,
    }

    const state = await buildGameState(c.env.DB, session)
    return c.json(state, 201)
  }
)

export { sessionRoutes }
