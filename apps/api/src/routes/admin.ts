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
import { getLivePreflightIssues } from '../db/queries.js'
import { getAssignedChallenge, getRandomActiveChallengeForCheckpoint, assignChallenge } from '../db/queries.js'
import { getAssistanceFeed, resolveAnswerReview, resolveSupportRequest } from '../lib/assistance.js'
import { getClosingDeadline, getClosingRemainingSeconds, getEffectiveEventStatus, isClosingGraceActive } from '../lib/event-lifecycle.js'

export const adminRoutes = new Hono<{ Bindings: Env }>()

export const EVENT_SETTINGS_UPDATE_SQL = `
    UPDATE event_settings SET
      updated_at = CASE
        WHEN status = 'CLOSING' AND ? = 'CLOSING' THEN updated_at
        ELSE datetime('now')
      END,
      status = ?,
      event_name = ?,
      points_per_correct = ?,
      wrong_answer_penalty = ?,
      hint_penalty = ?,
      minimum_expected_completion_minutes = ?
    WHERE id = 1
  `

export async function updateEventSettings(db: D1Database, data: z.infer<typeof eventSettingsSchema>) {
  await db.prepare(EVENT_SETTINGS_UPDATE_SQL).bind(
    data.status,
    data.status,
    data.event_name,
    data.points_per_correct,
    data.wrong_answer_penalty,
    data.hint_penalty,
    data.minimum_expected_completion_minutes,
  ).run()
}

async function getEventOverview(db: D1Database, now = Date.now()) {
  const settings = await db.prepare('SELECT * FROM event_settings WHERE id = 1').first<any>()
  if (!settings) return null
  const active = await db.prepare(`SELECT COUNT(*) AS count FROM sessions s
    JOIN participants p ON p.id = s.participant_id
    WHERE s.status = 'active' AND p.invalidated_at IS NULL`).first<{ count: number }>()
  return {
    ...settings,
    effectiveStatus: getEffectiveEventStatus(settings, now),
    closingDeadline: getClosingDeadline(settings),
    closingRemainingSeconds: getClosingRemainingSeconds(settings, now),
    activeSessions: Number(active?.count ?? 0),
  }
}

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
  return c.json(await getEventOverview(c.env.DB))
})

adminRoutes.get('/event/preflight', async (c) => {
  const issues = await getLivePreflightIssues(c.env.DB)
  return c.json({ ready: issues.length === 0, issues })
})

adminRoutes.put('/event', zValidator('json', eventSettingsSchema), async (c) => {
  const data = c.req.valid('json')
  if (data.status === 'LIVE') {
    const issues = await getLivePreflightIssues(c.env.DB)
    if (issues.length) return c.json({ error: 'LIVE_PREFLIGHT_FAILED', issues }, 422)
  }
  await updateEventSettings(c.env.DB, data)
  const overview = await getEventOverview(c.env.DB)
  return c.json(overview ? { success: true, ...overview } : { success: true })
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
  if (data.active && !data.is_start && !data.primary_clue) {
    return c.json({ error: 'PRIMARY_CLUE_REQUIRED' }, 400)
  }
  // Cannot have multiple starts
  if (data.is_start) {
    await c.env.DB.prepare('UPDATE checkpoints SET is_start = 0').run()
  }
  const token = crypto.randomUUID()
  const result = await c.env.DB.prepare(`
    INSERT INTO checkpoints (token, fallback_code, sequence_order, label, is_start, active, instruction, primary_clue, secondary_clue)
    VALUES (?, ?, (SELECT COALESCE(MAX(sequence_order),0)+1 FROM checkpoints), ?, ?, ?, ?, ?, ?)
  `).bind(token, crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(), data.label, data.is_start, data.active, data.instruction ?? null, data.primary_clue ?? null, data.secondary_clue ?? null).run()
  return c.json({ id: result.meta.last_row_id })
})

adminRoutes.put('/checkpoints/:id', zValidator('json', checkpointSchema), async (c) => {
  const id = parseInt(c.req.param('id'))
  const data = c.req.valid('json')
  if (data.active && !data.is_start && !data.primary_clue) {
    return c.json({ error: 'PRIMARY_CLUE_REQUIRED' }, 400)
  }
  if (data.is_start) {
    await c.env.DB.prepare('UPDATE checkpoints SET is_start = 0 WHERE id != ?').bind(id).run()
  }
  await c.env.DB.prepare(`
    UPDATE checkpoints SET label = ?, is_start = ?, active = ?, instruction = ?, primary_clue = ?, secondary_clue = ? WHERE id = ?
  `).bind(data.label, data.is_start, data.active, data.instruction ?? null, data.primary_clue ?? null, data.secondary_clue ?? null, id).run()
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
  if (data.active && data.needs_review) return c.json({ error: 'NEEDS_REVIEW_MUST_BE_INACTIVE' }, 400)
  const result = await c.env.DB.prepare(`
    INSERT INTO challenges (checkpoint_id, question_text, accepted_answers, hint_text, active, needs_review, review_note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(data.checkpoint_id, data.question_text, JSON.stringify(data.accepted_answers), data.hint_text, data.active, data.needs_review ?? 0, data.review_note ?? null).run()
  return c.json({ id: result.meta.last_row_id })
})

adminRoutes.put('/challenges/:id', zValidator('json', challengeSchema), async (c) => {
  const id = parseInt(c.req.param('id'))
  const data = c.req.valid('json')
  if (data.active && data.needs_review) return c.json({ error: 'NEEDS_REVIEW_MUST_BE_INACTIVE' }, 400)
  await c.env.DB.prepare(`
    UPDATE challenges SET checkpoint_id = ?, question_text = ?, accepted_answers = ?, hint_text = ?, active = ?, needs_review = ?, review_note = ?
    WHERE id = ?
  `).bind(data.checkpoint_id, data.question_text, JSON.stringify(data.accepted_answers), data.hint_text, data.active, data.needs_review ?? 0, data.review_note ?? null, id).run()
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


adminRoutes.post('/reset', async (c) => {
  // Hard delete participant-generated data
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM answer_review_requests'),
    c.env.DB.prepare('DELETE FROM support_requests'),
    c.env.DB.prepare('DELETE FROM hint_usage'),
    c.env.DB.prepare('DELETE FROM question_hint_usage'),
    c.env.DB.prepare('DELETE FROM scan_events'),
    c.env.DB.prepare('DELETE FROM answer_attempts'),
    c.env.DB.prepare('DELETE FROM session_challenge_assignments'),
    c.env.DB.prepare('DELETE FROM session_steps'),
    c.env.DB.prepare('DELETE FROM sessions'),
    c.env.DB.prepare('DELETE FROM participants'),
    // Reset event status to DRAFT
    c.env.DB.prepare("UPDATE event_settings SET status = 'DRAFT'")
  ])
  return c.json({ success: true })
})

adminRoutes.post('/participants/:id/invalidate', zValidator('json', z.object({ reason: z.string() })), async (c) => {
  const id = parseInt(c.req.param('id'))
  const { reason } = c.req.valid('json')
  await c.env.DB.prepare(
    "UPDATE participants SET invalidated_at = datetime('now'), invalidation_reason = ? WHERE id = ?"
  ).bind(reason, id).run()
  return c.json({ success: true })
})

adminRoutes.post('/participants/:id/release', async (c) => {
  const id = parseInt(c.req.param('id'))
  await c.env.DB.prepare(
    "UPDATE participants SET invalidated_at = NULL, invalidation_reason = NULL WHERE id = ?"
  ).bind(id).run()
  return c.json({ success: true })
})

adminRoutes.get('/assistance', async (c) => {
  return c.json(await getAssistanceFeed(c.env.DB))
})

adminRoutes.post('/assistance/reviews/:id/resolve', zValidator('json', z.object({ approve: z.boolean(), addAlias: z.boolean().optional(), note: z.string().max(500).optional() })), async (c) => {
  const result = await resolveAnswerReview(c.env.DB, Number(c.req.param('id')), c.req.valid('json'))
  return c.json(result.body, result.status)
})

adminRoutes.post('/assistance/support/:id/resolve', zValidator('json', z.object({ note: z.string().max(500).optional() })), async (c) => {
  return c.json(await resolveSupportRequest(c.env.DB, Number(c.req.param('id')), c.req.valid('json').note))
})

adminRoutes.post('/participants/:id/manual-checkpoint', async (c) => {
  const session = await c.env.DB.prepare("SELECT * FROM sessions WHERE participant_id=? AND status='active' ORDER BY id DESC LIMIT 1").bind(Number(c.req.param('id'))).first<any>()
  if (!session) return c.json({ error: 'NO_ACTIVE_SESSION' }, 404)
  const settings = await c.env.DB.prepare('SELECT status, updated_at FROM event_settings WHERE id=1').first<any>()
  if (settings?.status === 'CLOSING' && !isClosingGraceActive(settings, Date.now())) {
    return c.json({ state: 'CLOSING_EXPIRED' }, 409)
  }
  const step = await c.env.DB.prepare('SELECT checkpoint_id FROM session_steps WHERE session_id=? AND position=?').bind(session.id, session.current_step).first<{checkpoint_id:number}>()
  if (!step) return c.json({ error: 'ROUTE_ERROR' }, 400)
  if (!await getAssignedChallenge(c.env.DB, session.id, session.current_step)) {
    const challenge = await getRandomActiveChallengeForCheckpoint(c.env.DB, step.checkpoint_id)
    if (!challenge) return c.json({ error: 'NO_ACTIVE_CHALLENGES_AVAILABLE' }, 400)
    await assignChallenge(c.env.DB, session.id, session.current_step, challenge.id)
  }
  if (session.unlocked_step !== session.current_step) await c.env.DB.prepare('UPDATE sessions SET unlocked_step=? WHERE id=?').bind(session.current_step, session.id).run()
  await c.env.DB.prepare("INSERT INTO scan_events (session_id, checkpoint_id, raw_token, outcome) VALUES (?, ?, 'ORGANIZER_MANUAL', 'MANUAL_CHECKPOINT_VALIDATION')").bind(session.id, step.checkpoint_id).run()
  return c.json({ success: true })
})
