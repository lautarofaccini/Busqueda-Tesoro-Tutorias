import { Hono } from 'hono'
import type { Env } from '../env.d'

const sessionRoutes = new Hono<{ Bindings: Env }>()

/**
 * POST /api/session/start
 *
 * Phase 0: NOT IMPLEMENTED.
 * Returns HTTP 501 — an unambiguous stub.
 * No session is created. No game state is modified.
 */
sessionRoutes.post('/start', (c) => {
  return c.json(
    {
      error: 'NOT_IMPLEMENTED',
      message: 'Session management will be implemented in a later phase.',
    },
    501
  )
})

export { sessionRoutes }
