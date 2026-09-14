import { Hono } from 'hono'
import { checkpointRoutes } from './routes/checkpoint'
import { sessionRoutes } from './routes/session'
import type { Env } from './env.d'

const app = new Hono<{ Bindings: Env }>()

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'busqueda-tesoro-api', version: '0.0.0' })
})

// ── Game routes ──────────────────────────────────────────────────────────────
app.route('/api/session', sessionRoutes)
app.route('/api/checkpoint', checkpointRoutes)

// ── Fallback ─────────────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: 'NOT_FOUND' }, 404)
})

export default app
