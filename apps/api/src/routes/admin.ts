import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { getSignedCookie } from 'hono/cookie'
import { z } from 'zod'
import type { Env } from '../env.d'
import {
  eventSettingsSchema,
  checkpointSchema,
  challengeSchema,
  routeSchema,
} from '@busqueda-tesoro/shared'

export const adminRoutes = new Hono<{ Bindings: Env }>()

// Auth middleware for all admin routes
adminRoutes.use('*', async (c, next) => {
  const auth = await getSignedCookie(c, c.env.ORGANIZER_SECRET, 'organizer_auth')
  if (auth !== 'authenticated') {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }
  await next()
})

// --- EVENT SETTINGS ---
adminRoutes.get('/event', async (c) => {
  const settings = await c.env.DB.prepare('SELECT * FROM event_settings WHERE id = 1').first()
  return c.json(settings)
})

adminRoutes.put('/event', zValidator('json', eventSettingsSchema), async (c) => {
  const data = c.req.valid('json')
  await c.env.DB.prepare(`
    UPDATE event_settings SET 
      status = ?, 
      event_name = ?, 
      points_per_correct = ?, 
      wrong_answer_penalty = ?, 
      hint_penalty = ?, 
      minimum_expected_completion_minutes = ?,
      updated_at = datetime('now')
    WHERE id = 1
  `).bind(
    data.status,
    data.event_name,
    data.points_per_correct,
    data.wrong_answer_penalty,
    data.hint_penalty,
    data.minimum_expected_completion_minutes
  ).run()
  
  return c.json({ success: true })
})

// --- CHECKPOINTS ---
adminRoutes.get('/checkpoints', async (c) => {
  const results = await c.env.DB.prepare(`
    SELECT c.*, 
           (SELECT COUNT(*) FROM challenges WHERE checkpoint_id = c.id) as challengeCount,
           (SELECT COUNT(*) FROM route_steps WHERE checkpoint_id = c.id) as inRoutesCount
    FROM checkpoints c
    ORDER BY c.is_start DESC, c.id ASC
  `).all()
  return c.json(results.results)
})

adminRoutes.post('/checkpoints', zValidator('json', checkpointSchema), async (c) => {
  const data = c.req.valid('json')
  // Cannot have multiple starts
  if (data.is_start) {
    await c.env.DB.prepare('UPDATE checkpoints SET is_start = 0').run()
  }
  const token = crypto.randomUUID()
  const result = await c.env.DB.prepare(`
    INSERT INTO checkpoints (token, sequence_order, label, is_start, active)
    VALUES (?, (SELECT COALESCE(MAX(sequence_order),0)+1 FROM checkpoints), ?, ?, ?)
  `).bind(token, data.label, data.is_start, data.active).run()
  return c.json({ id: result.meta.last_row_id })
})

adminRoutes.put('/checkpoints/:id', zValidator('json', checkpointSchema), async (c) => {
  const id = parseInt(c.req.param('id'))
  const data = c.req.valid('json')
  if (data.is_start) {
    await c.env.DB.prepare('UPDATE checkpoints SET is_start = 0 WHERE id != ?').bind(id).run()
  }
  await c.env.DB.prepare(`
    UPDATE checkpoints SET label = ?, is_start = ?, active = ? WHERE id = ?
  `).bind(data.label, data.is_start, data.active, id).run()
  return c.json({ success: true })
})

adminRoutes.post('/checkpoints/:id/token', async (c) => {
  const id = parseInt(c.req.param('id'))
  const token = crypto.randomUUID()
  await c.env.DB.prepare('UPDATE checkpoints SET token = ? WHERE id = ?').bind(token, id).run()
  return c.json({ token })
})

// --- CHALLENGES ---
adminRoutes.get('/challenges', async (c) => {
  const results = await c.env.DB.prepare('SELECT * FROM challenges ORDER BY id ASC').all()
  return c.json(results.results.map(r => ({
    ...r,
    accepted_answers: JSON.parse(r.accepted_answers as string)
  })))
})

adminRoutes.post('/challenges', zValidator('json', challengeSchema), async (c) => {
  const data = c.req.valid('json')
  const result = await c.env.DB.prepare(`
    INSERT INTO challenges (checkpoint_id, question_text, accepted_answers, hint_text, active)
    VALUES (?, ?, ?, ?, ?)
  `).bind(data.checkpoint_id, data.question_text, JSON.stringify(data.accepted_answers), data.hint_text, data.active).run()
  return c.json({ id: result.meta.last_row_id })
})

adminRoutes.put('/challenges/:id', zValidator('json', challengeSchema), async (c) => {
  const id = parseInt(c.req.param('id'))
  const data = c.req.valid('json')
  await c.env.DB.prepare(`
    UPDATE challenges SET checkpoint_id = ?, question_text = ?, accepted_answers = ?, hint_text = ?, active = ?
    WHERE id = ?
  `).bind(data.checkpoint_id, data.question_text, JSON.stringify(data.accepted_answers), data.hint_text, data.active, id).run()
  return c.json({ success: true })
})

// --- ROUTES ---
adminRoutes.get('/routes', async (c) => {
  const routes = await c.env.DB.prepare('SELECT * FROM routes ORDER BY id ASC').all()
  const steps = await c.env.DB.prepare('SELECT * FROM route_steps ORDER BY route_id, position ASC').all()
  
  const mapped = routes.results.map(r => ({
    ...r,
    steps: steps.results.filter(s => s.route_id === r.id)
  }))
  return c.json(mapped)
})

adminRoutes.post('/routes', zValidator('json', routeSchema), async (c) => {
  const data = c.req.valid('json')
  const res = await c.env.DB.prepare('INSERT INTO routes (name, active) VALUES (?, ?)').bind(data.name, data.active).run()
  const routeId = res.meta.last_row_id
  
  const stmt = c.env.DB.prepare('INSERT INTO route_steps (route_id, position, checkpoint_id, clue_text) VALUES (?, ?, ?, ?)')
  const batch = data.steps.map(s => stmt.bind(routeId, s.position, s.checkpoint_id, s.clue_text))
  if (batch.length > 0) {
    await c.env.DB.batch(batch)
  }
  return c.json({ id: routeId })
})

adminRoutes.put('/routes/:id', zValidator('json', routeSchema), async (c) => {
  const id = parseInt(c.req.param('id'))
  const data = c.req.valid('json')
  
  await c.env.DB.prepare('UPDATE routes SET name = ?, active = ? WHERE id = ?').bind(data.name, data.active, id).run()
  await c.env.DB.prepare('DELETE FROM route_steps WHERE route_id = ?').bind(id).run()
  
  const stmt = c.env.DB.prepare('INSERT INTO route_steps (route_id, position, checkpoint_id, clue_text) VALUES (?, ?, ?, ?)')
  const batch = data.steps.map(s => stmt.bind(id, s.position, s.checkpoint_id, s.clue_text))
  if (batch.length > 0) {
    await c.env.DB.batch(batch)
  }
  
  return c.json({ success: true })
})
