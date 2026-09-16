/**
 * Checkpoint routes — Phase 0 stub, superseded by /api/scan/:token in Phase 1.
 * Kept for backward compatibility during transition.
 * @deprecated Use POST /api/scan/:token instead.
 */
import { Hono } from 'hono'
import type { Env } from '../env.d'

const checkpointRoutes = new Hono<{ Bindings: Env }>()

checkpointRoutes.get('/:token', (c) => {
  return c.json(
    {
      error: 'MOVED',
      message: 'Use POST /api/scan/:token',
    },
    308
  )
})

export { checkpointRoutes }
