/**
 * POST /api/scan/:token
 *
 * Called when a player navigates to /q/:token (simulating a QR scan).
 * POST because every scan is logged in scan_events for audit.
 *
 * State machine:
 *
 * 1. Token not in DB (unknown):
 *    → NEEDS_START (generic, reveals nothing)
 *
 * 2. No session cookie:
 *    - is_start = 1 → START_ALLOWED (player can register)
 *    - is_start = 0 → NEEDS_START (reveals nothing about checkpoint)
 *
 * 3. Session exists, status = completed:
 *    → COMPLETED
 *
 * 4. Session exists, status = active:
 *    - is_start = 1 → return current ACTIVE/CHALLENGE state (player rescanned start)
 *    - checkpoint != expected → WRONG_CHECKPOINT (no identity leaked)
 *    - checkpoint = expected, already unlocked → CHALLENGE (idempotent rescan)
 *    - checkpoint = expected, not yet unlocked → set unlocked_step, return CHALLENGE
 *
 * Security:
 *   NEEDS_START and WRONG_CHECKPOINT never reveal checkpoint identity.
 *   CHALLENGE never includes accepted answers.
 */
import { Hono } from 'hono'
import type { Env } from '../env.d'
import {
  getCheckpointByToken,
  getAnySession,
  getRouteStep,
  logScanEvent,
  unlockStep,
  getAssignedChallenge,
  getRandomActiveChallengeForCheckpoint,
  assignChallenge,
  getEventSettings,
} from '../db/queries.js'
import { getSessionToken, buildSessionCookie, isLocalRequest } from '../lib/cookies.js'
import { buildGameState } from '../lib/game-state.js'

const scanRoutes = new Hono<{ Bindings: Env }>()

scanRoutes.post('/:token', async (c) => {
  const rawToken = c.req.param('token')
  const cookieHeader = c.req.header('cookie') ?? null
  const sessionToken = getSessionToken(cookieHeader)
  const secure = !isLocalRequest(c.req.url)

  // 1. Resolve token
  const checkpoint = await getCheckpointByToken(c.env.DB, rawToken)

  if (!checkpoint) {
    // Unknown token — return a generic safe state. Do not reveal token invalidity details.
    await logScanEvent(c.env.DB, {
      sessionId: null,
      checkpointId: null,
      rawToken,
      outcome: 'UNKNOWN_TOKEN',
    })
    return c.json({ state: 'NEEDS_START' })
  }

  // 2. No session
  if (!sessionToken) {
    if (checkpoint.is_start === 1) {
      await logScanEvent(c.env.DB, {
        sessionId: null,
        checkpointId: checkpoint.id,
        rawToken,
        outcome: 'START_ALLOWED',
      })
      return c.json({ state: 'START_ALLOWED', startToken: rawToken })
    }
    await logScanEvent(c.env.DB, {
      sessionId: null,
      checkpointId: checkpoint.id,
      rawToken,
      outcome: 'NEEDS_START',
    })
    return c.json({ state: 'NEEDS_START' })
  }

  // 3. Session lookup
  const session = await getAnySession(c.env.DB, sessionToken)

  if (!session) {
    // Stale cookie — clear it
    c.header('Set-Cookie', 'gst=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
    if (checkpoint.is_start === 1) {
      await logScanEvent(c.env.DB, {
        sessionId: null,
        checkpointId: checkpoint.id,
        rawToken,
        outcome: 'START_ALLOWED',
      })
      return c.json({ state: 'START_ALLOWED', startToken: rawToken })
    }
    await logScanEvent(c.env.DB, {
      sessionId: null,
      checkpointId: checkpoint.id,
      rawToken,
      outcome: 'NEEDS_START',
    })
    return c.json({ state: 'NEEDS_START' })
  }

  // 4. Completed session
  if (session.status === 'completed') {
    await logScanEvent(c.env.DB, {
      sessionId: session.id,
      checkpointId: checkpoint.id,
      rawToken,
      outcome: 'ALREADY_COMPLETED',
    })
    return c.json({
      state: 'COMPLETED',
      playerName: session.player_name,
      completedAt: session.completed_at ?? new Date().toISOString(),
    })
  }

  const settings = await getEventSettings(c.env.DB)
  if (settings?.status === 'PAUSED') return c.json({ state: 'EVENT_PAUSED' })
  if (settings?.status === 'ENDED') return c.json({ state: 'EVENT_ENDED' })

  // Refresh cookie
  c.header('Set-Cookie', buildSessionCookie(sessionToken, secure))

  // 5. Active session — start checkpoint rescanned
  if (checkpoint.is_start === 1) {
    await logScanEvent(c.env.DB, {
      sessionId: session.id,
      checkpointId: checkpoint.id,
      rawToken,
      outcome: 'START_RESCANNED',
    })
    const state = await buildGameState(c.env.DB, session)
    return c.json(state)
  }

  // 6. Check expected checkpoint
  const expectedStep = await getRouteStep(c.env.DB, session.route_id, session.current_step)
  if (!expectedStep) {
    return c.json({ error: 'ROUTE_ERROR' }, 500)
  }

  if (checkpoint.id !== expectedStep.checkpoint_id) {
    // Wrong checkpoint — reveal nothing about which one it is
    await logScanEvent(c.env.DB, {
      sessionId: session.id,
      checkpointId: checkpoint.id,
      rawToken,
      outcome: 'WRONG_CHECKPOINT',
    })
    return c.json({ state: 'WRONG_CHECKPOINT' })
  }

  // 7. Correct checkpoint
  if (session.unlocked_step === session.current_step) {
    // Already unlocked — idempotent rescan
    await logScanEvent(c.env.DB, {
      sessionId: session.id,
      checkpointId: checkpoint.id,
      rawToken,
      outcome: 'CHALLENGE_RESCANNED',
    })
    const state = await buildGameState(c.env.DB, session)
    return c.json(state)
  }

  // First scan of this checkpoint — assign a question pool challenge and unlock
  let challenge = await getAssignedChallenge(c.env.DB, session.id, session.current_step)
  if (!challenge) {
    const randomChallenge = await getRandomActiveChallengeForCheckpoint(c.env.DB, checkpoint.id)
    if (!randomChallenge) {
      return c.json({ error: 'NO_ACTIVE_CHALLENGES_AVAILABLE' }, 500)
    }
    // INSERT OR IGNORE protects against concurrent scan assignments.
    await assignChallenge(c.env.DB, session.id, session.current_step, randomChallenge.id)
    
    // Always fetch the authoritative assignment that actually exists in the DB now, 
    // resolving any races where another request assigned it first.
    challenge = (await getAssignedChallenge(c.env.DB, session.id, session.current_step))!
  }

  await unlockStep(c.env.DB, session.id, session.current_step)
  await logScanEvent(c.env.DB, {
    sessionId: session.id,
    checkpointId: checkpoint.id,
    rawToken,
    outcome: 'CHALLENGE',
  })

  const updatedSession = { ...session, unlocked_step: session.current_step }
  const state = await buildGameState(c.env.DB, updatedSession)
  return c.json(state)
})

export { scanRoutes }
