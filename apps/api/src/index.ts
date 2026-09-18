import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { gameRoutes } from './routes/game.js'
import { sessionRoutes } from './routes/session.js'
import { scanRoutes } from './routes/scan.js'
import { answerRoutes } from './routes/answer.js'
import { organizerRoutes } from './routes/organizer.js'
import { adminRoutes } from './routes/admin.js'
import { supportRoutes } from './routes/support.js'
import type { Env } from './env.d'

const app = new Hono<{ Bindings: Env }>()

// ── CORS (dev only — in production, Vite proxy handles this) ─────────────
// Allow the Vite dev server to call the Worker directly if needed.
app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true, // required for cookie to be sent/received
  })
)

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'busqueda-tesoro-api', version: '0.1.0' })
})

// ── Game routes ───────────────────────────────────────────────────────────
app.route('/api/game', gameRoutes)         // GET /api/game/state
app.route('/api/session', sessionRoutes)   // POST /api/session/start
app.route('/api/scan', scanRoutes)         // POST /api/scan/:token
app.route('/api/challenge', answerRoutes)  // POST /api/challenge/:challengeId/answer
app.route('/api/organizer', organizerRoutes) // POST /login, GET /results
app.route('/api/admin', adminRoutes)
app.route('/api/support', supportRoutes)

// ── Fallback ──────────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: 'NOT_FOUND' }, 404)
})

export default app
