/**
 * GET /api/game/state
 *
 * Returns the current GameState for the session carried in the cookie.
 * Used on page load/refresh to recover state without re-scanning a QR.
 *
 * Security: never includes accepted_answers or future checkpoint tokens.
 */
import { Hono } from 'hono'
import type { Env } from '../env.d'
import { getSessionToken, buildSessionCookie } from '../lib/cookies.js'
import { getAnySession, getEventSettings, logHintUsage, getSessionStep, getAssignedChallenge, hasUsedQuestionHint, logQuestionHintUsage } from '../db/queries.js'
import { buildGameState } from '../lib/game-state.js'

const gameRoutes = new Hono<{ Bindings: Env }>()

gameRoutes.get('/state', async (c) => {
  const cookieHeader = c.req.header('cookie') ?? null
  const sessionToken = getSessionToken(cookieHeader)

  if (!sessionToken) {
    return c.json({ state: 'NEEDS_START' })
  }

  const session = await getAnySession(c.env.DB, sessionToken)
  if (!session) {
    // Token exists but not in DB — clear the stale cookie
    c.header('Set-Cookie', 'gst=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
    return c.json({ state: 'NEEDS_START' })
  }

  if (session.status !== 'completed') {
    const settings = await getEventSettings(c.env.DB)
    if (settings?.status === 'PAUSED') return c.json({ state: 'EVENT_PAUSED' })
    if (settings?.status === 'ENDED') return c.json({ state: 'EVENT_ENDED' })
    if (settings?.status !== 'LIVE') return c.json({ error: 'EVENT_NOT_LIVE' }, 403)
  }

  // Refresh cookie lifetime on each page load
  const secure = c.env.ENVIRONMENT === 'production'
  c.header('Set-Cookie', buildSessionCookie(sessionToken, secure))

  const state = await buildGameState(c.env.DB, session)
  return c.json(state)
})


gameRoutes.post('/secondary-hint', async (c) => {
  const cookieHeader = c.req.header('cookie') ?? null
  const sessionToken = getSessionToken(cookieHeader)

  if (!sessionToken) {
    return c.json({ state: 'NEEDS_START' })
  }

  const session = await getAnySession(c.env.DB, sessionToken)
  if (!session || session.status === 'completed') {
    return c.json({ error: 'INVALID_SESSION' }, 400)
  }

  const settings = await getEventSettings(c.env.DB)
  if (settings?.status === 'PAUSED') return c.json({ state: 'EVENT_PAUSED' })
  if (settings?.status === 'ENDED') return c.json({ state: 'EVENT_ENDED' })

  if (session.unlocked_step === session.current_step) {
    return c.json({ error: 'ALREADY_AT_CHECKPOINT' }, 400)
  }

  const step = await getSessionStep(c.env.DB, session.id, session.current_step)
  if (!step?.secondary_clue) {
    return c.json({ error: 'NO_HINT_AVAILABLE' }, 400)
  }

  await logHintUsage(c.env.DB, session.id, session.current_step)

  const state = await buildGameState(c.env.DB, session)
  return c.json(state)
})

gameRoutes.post('/question-hint', async (c) => {
  const sessionToken = getSessionToken(c.req.header('cookie') ?? null)
  if (!sessionToken) return c.json({ state: 'NEEDS_START' })
  const session = await getAnySession(c.env.DB, sessionToken)
  if (!session || session.status !== 'active') return c.json({ error: 'INVALID_SESSION' }, 400)
  const settings = await getEventSettings(c.env.DB)
  if (settings?.status === 'PAUSED') return c.json({ state: 'EVENT_PAUSED' })
  if (settings?.status === 'ENDED') return c.json({ state: 'EVENT_ENDED' })
  if (settings?.status !== 'LIVE') return c.json({ error: 'EVENT_NOT_LIVE' }, 403)
  if (session.unlocked_step !== session.current_step) return c.json({ error: 'NOT_AT_CHECKPOINT' }, 400)
  const challenge = await getAssignedChallenge(c.env.DB, session.id, session.current_step)
  if (!challenge?.hint_text) return c.json({ error: 'NO_HINT_AVAILABLE' }, 400)
  const wrong = await c.env.DB.prepare('SELECT 1 FROM answer_attempts WHERE session_id = ? AND challenge_id = ? AND correct = 0').bind(session.id, challenge.id).first()
  if (!wrong) return c.json({ error: 'NO_WRONG_ANSWERS_YET' }, 400)
  if (!await hasUsedQuestionHint(c.env.DB, session.id, challenge.id)) await logQuestionHintUsage(c.env.DB, session.id, challenge.id)
  return c.json(await buildGameState(c.env.DB, session))
})

export { gameRoutes }
