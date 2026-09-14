import { Hono } from 'hono'
import type { Env } from '../env.d'

const checkpointRoutes = new Hono<{ Bindings: Env }>()

/**
 * GET /api/checkpoint/:token
 *
 * Phase 0: NOT IMPLEMENTED.
 * Returns HTTP 501. The token is intentionally not read or echoed
 * to avoid leaking checkpoint identity in any logs.
 */
checkpointRoutes.get('/:token', (c) => {
  return c.json(
    {
      error: 'NOT_IMPLEMENTED',
      message: 'Checkpoint validation will be implemented in a later phase.',
    },
    501
  )
})

export { checkpointRoutes }
