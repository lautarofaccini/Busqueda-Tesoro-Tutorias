import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { normalizeAnswer } from '@busqueda-tesoro/shared'
import type { Env } from '../env.d'
import { getAnySession, getEventSettings, getSessionScore, getSessionStep } from '../db/queries.js'
import { getSessionToken } from '../lib/cookies.js'
import { processCheckpointScan } from './scan.js'
import { isClosingGraceActive } from '../lib/event-lifecycle.js'

export const supportRoutes = new Hono<{ Bindings: Env }>()

export function calculateReviewScoreCorrection(
  review: { status: string; awarded_correct?: number | null; reversed_wrong?: number | null },
  settings?: { points_per_correct?: number | null; wrong_answer_penalty?: number | null } | null,
) {
  if (review.status !== 'APPROVED') return 0
  return Number(review.awarded_correct || 0) * Number(settings?.points_per_correct ?? 100)
    + Number(review.reversed_wrong || 0) * Number(settings?.wrong_answer_penalty ?? 10)
}

async function currentSession(c: any) {
  const token = getSessionToken(c.req.header('cookie') ?? null)
  return token ? getAnySession(c.env.DB, token) : null
}

async function closingExpiredForActiveSession(c: any, session: { status: string }) {
  if (session.status !== 'active') return false
  const settings = await getEventSettings(c.env.DB)
  return settings?.status === 'CLOSING' && !isClosingGraceActive(settings, Date.now())
}

supportRoutes.post('/fallback-code', zValidator('json', z.object({ code: z.string().min(1).max(20) })), async (c) => {
  return processCheckpointScan(c, c.req.valid('json').code, true)
})

supportRoutes.post('/requests', zValidator('json', z.object({ category: z.enum(['QR_SCAN', 'QR_DAMAGED', 'OTHER']), note: z.string().max(500).optional() })), async (c) => {
  const session = await currentSession(c)
  if (!session || session.status !== 'active') return c.json({ error: 'INVALID_SESSION' }, 401)
  if (await closingExpiredForActiveSession(c, session)) return c.json({ state: 'CLOSING_EXPIRED' })
  const step = await getSessionStep(c.env.DB, session.id, session.current_step)
  const input = c.req.valid('json')
  const duplicate = await c.env.DB.prepare(`SELECT id FROM support_requests
    WHERE session_id = ? AND category = ? AND status = 'PENDING'
      AND created_at >= datetime('now', '-60 seconds') LIMIT 1`).bind(session.id, input.category).first()
  if (duplicate) return c.json({ success: true, id: Number(duplicate.id), duplicate: true, message: 'Ya enviamos este aviso a Tutorías.' })
  const inserted = await c.env.DB.prepare('INSERT INTO support_requests (session_id, participant_id, checkpoint_id, category, note) VALUES (?, (SELECT participant_id FROM sessions WHERE id = ?), ?, ?, ?)')
    .bind(session.id, session.id, step?.checkpoint_id ?? null, input.category, input.note ?? null).run()
  return c.json({ success: true, id: Number(inserted.meta.last_row_id) })
})

supportRoutes.post('/answer-reviews', zValidator('json', z.object({ attemptId: z.number().int() })), async (c) => {
  const session = await currentSession(c)
  if (!session) return c.json({ error: 'INVALID_SESSION' }, 401)
  if (await closingExpiredForActiveSession(c, session)) return c.json({ state: 'CLOSING_EXPIRED' })
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
  const reviews = await c.env.DB.prepare('SELECT id, challenge_id, answer_attempt_id, status, score_at_request, awarded_correct, reversed_wrong, created_at, resolved_at FROM answer_review_requests WHERE session_id = ? ORDER BY id DESC').bind(session.id).all<any>()
  const support = await c.env.DB.prepare('SELECT id, category, status, created_at FROM support_requests WHERE session_id = ? ORDER BY id DESC').bind(session.id).all()
  const settings = await c.env.DB.prepare(`SELECT er.points_per_correct, er.wrong_answer_penalty
    FROM sessions s JOIN event_runs er ON er.id = s.event_run_id WHERE s.id = ?`).bind(session.id).first<any>()
  return c.json({ reviews: reviews.results.map((review: any) => ({
    ...review,
    scoreCorrection: calculateReviewScoreCorrection(review, settings),
  })), support: support.results })
})
