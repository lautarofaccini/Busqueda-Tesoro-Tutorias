import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { normalizeAnswer } from '@busqueda-tesoro/shared'
import type { Env } from '../env.d'
import { getAnySession, getSessionScore, getSessionStep } from '../db/queries.js'
import { getSessionToken } from '../lib/cookies.js'
import { processCheckpointScan } from './scan.js'

export const supportRoutes = new Hono<{ Bindings: Env }>()

async function currentSession(c: any) {
  const token = getSessionToken(c.req.header('cookie') ?? null)
  return token ? getAnySession(c.env.DB, token) : null
}

supportRoutes.post('/fallback-code', zValidator('json', z.object({ code: z.string().min(1).max(20) })), async (c) => {
  return processCheckpointScan(c, c.req.valid('json').code, true)
})

supportRoutes.post('/requests', zValidator('json', z.object({ category: z.enum(['QR_SCAN', 'QR_DAMAGED', 'OTHER']), note: z.string().max(500).optional() })), async (c) => {
  const session = await currentSession(c)
  if (!session || session.status !== 'active') return c.json({ error: 'INVALID_SESSION' }, 401)
  const step = await getSessionStep(c.env.DB, session.id, session.current_step)
  await c.env.DB.prepare('INSERT INTO support_requests (session_id, participant_id, checkpoint_id, category, note) VALUES (?, (SELECT participant_id FROM sessions WHERE id = ?), ?, ?, ?)')
    .bind(session.id, session.id, step?.checkpoint_id ?? null, c.req.valid('json').category, c.req.valid('json').note ?? null).run()
  return c.json({ success: true })
})

supportRoutes.post('/answer-reviews', zValidator('json', z.object({ attemptId: z.number().int() })), async (c) => {
  const session = await currentSession(c)
  if (!session) return c.json({ error: 'INVALID_SESSION' }, 401)
  const attempt = await c.env.DB.prepare('SELECT id, challenge_id, raw_answer FROM answer_attempts WHERE id = ? AND session_id = ? AND correct = 0').bind(c.req.valid('json').attemptId, session.id).first<{ id:number; challenge_id:number; raw_answer:string }>()
  if (!attempt) return c.json({ error: 'ATTEMPT_NOT_REVIEWABLE' }, 404)
  const checkpoint = await c.env.DB.prepare('SELECT checkpoint_id FROM challenges WHERE id = ?').bind(attempt.challenge_id).first<{ checkpoint_id:number }>()
  const score = await getSessionScore(c.env.DB, session.id)
  await c.env.DB.prepare('INSERT OR IGNORE INTO answer_review_requests (session_id, participant_id, checkpoint_id, challenge_id, answer_attempt_id, raw_answer, normalized_answer, score_at_request) VALUES (?, (SELECT participant_id FROM sessions WHERE id = ?), ?, ?, ?, ?, ?, ?)')
    .bind(session.id, session.id, checkpoint?.checkpoint_id, attempt.challenge_id, attempt.id, attempt.raw_answer, normalizeAnswer(attempt.raw_answer), score).run()
  return c.json({ success: true })
})

supportRoutes.get('/status', async (c) => {
  const session = await currentSession(c)
  if (!session) return c.json({ requests: [] })
  const reviews = await c.env.DB.prepare('SELECT id, status, created_at FROM answer_review_requests WHERE session_id = ? ORDER BY id DESC').bind(session.id).all()
  const support = await c.env.DB.prepare('SELECT id, category, status, created_at FROM support_requests WHERE session_id = ? ORDER BY id DESC').bind(session.id).all()
  return c.json({ reviews: reviews.results, support: support.results })
})
