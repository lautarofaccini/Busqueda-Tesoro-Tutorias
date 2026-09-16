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
import { getAnySession, getActiveSession, getEventSettings } from '../db/queries.js'
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
  }

  // Refresh cookie lifetime on each page load
  const secure = c.env.ENVIRONMENT === 'production'
  c.header('Set-Cookie', buildSessionCookie(sessionToken, secure))

  const state = await buildGameState(c.env.DB, session)
  return c.json(state)
})

export { gameRoutes }
