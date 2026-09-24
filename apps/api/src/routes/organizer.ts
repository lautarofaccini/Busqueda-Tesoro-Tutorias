import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getSignedCookie, setSignedCookie } from 'hono/cookie'
import type { Env } from '../env.d'
import { getOrganizerPlayerDetail, getOrganizerResults, getOrganizerStateSince } from '../db/queries.js'
import { timingSafeSecretEqual } from '../lib/auth.js'
import { deriveOperationalPlayerState } from '../lib/game-state.js'
import { parsePersistedUtc } from '../lib/timestamps.js'
import { getClosingDeadline, getClosingRemainingSeconds, getEffectiveEventStatus, getSessionResultStatus, isCompetitiveCompletedSession } from '../lib/event-lifecycle.js'
import { getRunAnalytics, listEventRuns } from '../lib/analytics.js'
import { calculatePostEventScore } from '../lib/post-event-scoring.js'


export const organizerRoutes = new Hono<{ Bindings: Env }>()

const AUTH_COOKIE = 'organizer_auth'

export async function isLoginRateLimited(limiter: RateLimit | undefined, actorKey: string): Promise<boolean> {
  if (!limiter) return false
  const result = await limiter.limit({ key: `organizer-login:${actorKey}` })
  return !result.success
}

organizerRoutes.post(
  '/login',
  zValidator('json', z.object({ username: z.string().min(1), password: z.string().min(1) }), (result, c) => {
    if (!result.success) return c.json({ error: 'INVALID_INPUT' }, 400)
  }),
  async (c) => {
    const { username, password } = c.req.valid('json')
    // Cloudflare sets this trusted header at the edge. Do not trust client-supplied X-Forwarded-For.
    const actorKey = c.req.header('CF-Connecting-IP') ?? 'unknown'
    if (await isLoginRateLimited(c.env.ADMIN_LOGIN_LIMITER, actorKey)) return c.json({ error: 'RATE_LIMITED' }, 429)
    if (!c.env.ADMIN_USERNAME || !c.env.ADMIN_PASSWORD || !c.env.ORGANIZER_SECRET) {
      return c.json({ error: 'ADMIN_AUTH_NOT_CONFIGURED' }, 503)
    }
    const [usernameValid, passwordValid] = await Promise.all([
      timingSafeSecretEqual(c.env.ADMIN_USERNAME, username),
      timingSafeSecretEqual(c.env.ADMIN_PASSWORD, password),
    ])
    if (!usernameValid || !passwordValid) {
      return c.json({ error: 'UNAUTHORIZED' }, 401)
    }

    const secure = c.env.ENVIRONMENT === 'production'
    await setSignedCookie(c, AUTH_COOKIE, 'authenticated', c.env.ORGANIZER_SECRET, {
      httpOnly: true,
      secure,
      sameSite: 'Strict',
      path: '/api',
      maxAge: 60 * 60 * 4,
    })
    return c.json({ success: true })
  }
)

organizerRoutes.post('/logout', async (c) => {
  const secure = c.env.ENVIRONMENT === 'production'
  await setSignedCookie(c, AUTH_COOKIE, '', c.env.ORGANIZER_SECRET, {
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: '/api',
    maxAge: 0,
  })
  return c.json({ success: true })
})

async function hasOrganizerSession(c: any) {
  if (!c.env.ORGANIZER_SECRET) return false
  return await getSignedCookie(c, c.env.ORGANIZER_SECRET, AUTH_COOKIE) === 'authenticated'
}

organizerRoutes.get('/players/:sessionId', async (c) => {
  if (!await hasOrganizerSession(c)) return c.json({ error: 'UNAUTHORIZED' }, 401)
  const sessionId = Number(c.req.param('sessionId'))
  if (!Number.isInteger(sessionId) || sessionId <= 0) return c.json({ error: 'INVALID_SESSION_ID' }, 400)
  const detail = await getOrganizerPlayerDetail(c.env.DB, sessionId)
  if (!detail) return c.json({ error: 'NOT_FOUND' }, 404)
  const run = await c.env.DB.prepare(`SELECT status, closing_at FROM event_runs WHERE id = ?`).bind(detail.eventRunId).first<any>()
  const effectiveStatus = run?.status === 'CLOSING' && run.closing_at && Date.now() >= parsePersistedUtc(run.closing_at) + 30 * 60 * 1000
    ? 'ENDED' : run?.status ?? 'DRAFT'
  const resultStatus = getSessionResultStatus(detail.status, effectiveStatus)
  const incomplete = resultStatus === 'INCOMPLETE'
  return c.json({
    ...detail,
    resultStatus,
    currentState: incomplete ? 'NO_COMPLETO' : deriveOperationalPlayerState({
      status: detail.status,
      current_step: detail.currentStep,
      unlocked_step: detail.unlockedStep,
    }),
  })
})

const scoreAdjustmentSchema = z.object({
  amount: z.union([z.literal(10), z.literal(5), z.literal(-10), z.literal(-5)]),
  reason: z.string().trim().min(5).max(1000),
  idempotencyKey: z.string().trim().min(8).max(100),
  relatedAttemptId: z.number().int().positive().optional(),
  compensatesAdjustmentId: z.number().int().positive().optional(),
})

organizerRoutes.post('/players/:sessionId/score-adjustments', zValidator('json', scoreAdjustmentSchema), async (c) => {
  if (!await hasOrganizerSession(c)) return c.json({ error: 'UNAUTHORIZED' }, 401)
  const sessionId = Number(c.req.param('sessionId'))
  if (!Number.isInteger(sessionId) || sessionId <= 0) return c.json({ error: 'INVALID_SESSION_ID' }, 400)
  const session = await c.env.DB.prepare('SELECT id FROM sessions WHERE id=?').bind(sessionId).first()
  if (!session) return c.json({ error: 'NOT_FOUND' }, 404)
  const input = c.req.valid('json')
  if (input.relatedAttemptId) {
    const attempt = await c.env.DB.prepare('SELECT id FROM answer_attempts WHERE id=? AND session_id=?').bind(input.relatedAttemptId, sessionId).first()
    if (!attempt) return c.json({ error: 'ATTEMPT_NOT_IN_SESSION' }, 422)
  }
  if (input.compensatesAdjustmentId) {
    const original = await c.env.DB.prepare('SELECT id FROM score_adjustments WHERE id=? AND session_id=?').bind(input.compensatesAdjustmentId, sessionId).first()
    if (!original) return c.json({ error: 'ADJUSTMENT_NOT_IN_SESSION' }, 422)
  }
  const existing = await c.env.DB.prepare('SELECT * FROM score_adjustments WHERE idempotency_key=?').bind(input.idempotencyKey).first<any>()
  if (existing) {
    const same = Number(existing.session_id) === sessionId && Number(existing.amount) === input.amount && existing.reason === input.reason
    return same ? c.json({ success: true, id: Number(existing.id), idempotent: true }) : c.json({ error: 'IDEMPOTENCY_KEY_REUSED' }, 409)
  }
  const inserted = await c.env.DB.prepare(`INSERT OR IGNORE INTO score_adjustments
    (session_id, amount, reason, idempotency_key, related_attempt_id, compensates_adjustment_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(sessionId, input.amount, input.reason, input.idempotencyKey, input.relatedAttemptId ?? null,
      input.compensatesAdjustmentId ?? null, c.env.ADMIN_USERNAME ?? 'organizer').run()
  if (Number(inserted.meta.changes ?? 0) === 0) {
    const raced = await c.env.DB.prepare('SELECT id, session_id, amount, reason FROM score_adjustments WHERE idempotency_key=?').bind(input.idempotencyKey).first<any>()
    const same = raced && Number(raced.session_id) === sessionId && Number(raced.amount) === input.amount && raced.reason === input.reason
    return same ? c.json({ success: true, id: Number(raced.id), idempotent: true }) : c.json({ error: 'IDEMPOTENCY_KEY_REUSED' }, 409)
  }
  await c.env.DB.prepare('UPDATE sessions SET audit_reviewed_at=NULL, audit_reviewed_by=NULL WHERE id=?').bind(sessionId).run()
  const detail = await getOrganizerPlayerDetail(c.env.DB, sessionId)
  return c.json({ success: true, id: Number(inserted.meta.last_row_id), score: detail?.score, scoreBreakdown: detail?.scoreBreakdown }, 201)
})

organizerRoutes.put('/players/:sessionId/audit-status', zValidator('json', z.object({ reviewed: z.boolean() })), async (c) => {
  if (!await hasOrganizerSession(c)) return c.json({ error: 'UNAUTHORIZED' }, 401)
  const sessionId = Number(c.req.param('sessionId'))
  if (!Number.isInteger(sessionId) || sessionId <= 0) return c.json({ error: 'INVALID_SESSION_ID' }, 400)
  const { reviewed } = c.req.valid('json')
  const result = await c.env.DB.prepare(`UPDATE sessions SET
    audit_reviewed_at=CASE WHEN ? THEN datetime('now') ELSE NULL END,
    audit_reviewed_by=CASE WHEN ? THEN ? ELSE NULL END WHERE id=?`)
    .bind(reviewed ? 1 : 0, reviewed ? 1 : 0, c.env.ADMIN_USERNAME ?? 'organizer', sessionId).run()
  if (Number(result.meta.changes ?? 0) === 0) return c.json({ error: 'NOT_FOUND' }, 404)
  return c.json({ success: true, auditStatus: reviewed ? 'REVIEWED' : 'PENDING' })
})

organizerRoutes.get('/runs', async (c) => {
  if (!await hasOrganizerSession(c)) return c.json({ error: 'UNAUTHORIZED' }, 401)
  return c.json({ runs: await listEventRuns(c.env.DB) })
})

organizerRoutes.get('/runs/:runId/analytics', async (c) => {
  if (!await hasOrganizerSession(c)) return c.json({ error: 'UNAUTHORIZED' }, 401)
  const runId = Number(c.req.param('runId'))
  if (!Number.isInteger(runId) || runId <= 0) return c.json({ error: 'INVALID_RUN_ID' }, 400)
  const analytics = await getRunAnalytics(c.env.DB, runId)
  return analytics ? c.json(analytics) : c.json({ error: 'NOT_FOUND' }, 404)
})

organizerRoutes.get('/results', async (c) => {
  if (!await hasOrganizerSession(c)) {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }

  const rawResults = await getOrganizerResults(c.env.DB)
  const now = Date.now()
  const settings = await c.env.DB.prepare('SELECT status, updated_at FROM event_settings WHERE id=1').first<any>()
  const effectiveStatus = settings ? getEffectiveEventStatus(settings, now) : 'DRAFT'

  const players = await Promise.all(rawResults.map(async (r: any) => {
    // Only compute score if completed
    let score = null
    let durationSec = null
    let needsReview = false
    
    if (r.status === 'completed' && r.completedAt) {
      score = calculatePostEventScore({
        rawCorrectCount: Number(r.correctCount), rawWrongCount: Number(r.wrongCount),
        hintCount: Number(r.hintsUsed), pointsPerCorrect: Number(r.pointsPerCorrect),
        wrongAnswerPenalty: Number(r.wrongAnswerPenalty), hintPenalty: Number(r.hintPenalty),
        manualAdjustmentTotal: Number(r.manualAdjustmentTotal ?? 0),
      }).finalScore
      const start = parsePersistedUtc(r.startedAt)
      const end = parsePersistedUtc(r.completedAt)
      durationSec = Math.floor((end - start) / 1000)
      
      if (durationSec < 300) {
        needsReview = true
      }
    }

    const stateSince = await getOrganizerStateSince(c.env.DB, {
      id: Number(r.id),
      playerName: r.playerName,
      career: r.career,
      identifierType: r.identifierType,
      identifierSuffix: r.identifierSuffix,
      status: r.status,
      currentStep: Number(r.currentStep),
      unlockedStep: r.unlockedStep === null ? null : Number(r.unlockedStep),
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      totalSteps: Number(r.totalSteps),
    })
    const resultStatus = getSessionResultStatus(r.status, effectiveStatus)
    return {
      id: r.id, // Session ID
      participantId: r.participantId,
      playerName: r.playerName,
      identifierType: r.identifierType,
      identifierSuffix: r.identifierSuffix,
      career: r.career,
      invalidatedAt: r.invalidatedAt,
      status: r.status,
      currentStep: r.currentStep,
      totalSteps: r.totalSteps,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      hintsUsed: r.hintsUsed,
      approvedReviewCount: Number(r.approvedReviewCount ?? 0),
      manualAdjustmentTotal: Number(r.manualAdjustmentTotal ?? 0),
      manualAdjustmentCount: Number(r.manualAdjustmentCount ?? 0),
      auditStatus: r.auditReviewedAt ? 'REVIEWED' : 'PENDING',
      score,
      durationSec,
      needsReview,
      currentState: resultStatus === 'INCOMPLETE' ? 'NO_COMPLETO' : deriveOperationalPlayerState({ status: r.status, current_step: Number(r.currentStep), unlocked_step: r.unlockedStep === null ? null : Number(r.unlockedStep) }),
      stateSince: stateSince.value,
      pendingReview: Boolean(r.pendingReview),
      resultStatus,
    }
  }))

  // Ranking:
  // 1. Sort by score descending
  // 2. Tie groups are explicitly marked
  // Only completed sessions get a rank
  
  const completed = players
    .filter(p => isCompetitiveCompletedSession(p.status, p.invalidatedAt))
    .map(p => ({ ...p, rank: 0, isTied: false }))
    
  // Sort descending by score
  completed.sort((a, b) => b.score! - a.score!)

  let currentRank = 1
  for (let i = 0; i < completed.length; i++) {
    const current = completed[i]!
    const prev = i > 0 ? completed[i - 1]! : null

    if (prev && current.score === prev.score) {
      current.rank = currentRank // tie
    } else {
      currentRank = i + 1
      current.rank = currentRank
    }
  }

  for (let i = 0; i < completed.length; i++) {
    completed[i]!.isTied = completed.some((other, index) => index !== i && other.score === completed[i]!.score)
  }

  const active = players.filter(p => p.resultStatus === 'IN_PROGRESS' && !p.invalidatedAt)
  const incomplete = players.filter(p => p.resultStatus === 'INCOMPLETE' && !p.invalidatedAt)
  const invalidated = players.filter(p => p.invalidatedAt)
  // Display ordering purely, no rank
  active.sort((a, b) => parsePersistedUtc(b.startedAt) - parsePersistedUtc(a.startedAt))
  incomplete.sort((a, b) => parsePersistedUtc(b.startedAt) - parsePersistedUtc(a.startedAt))

  return c.json({
    totals: {
      all: players.length,
      active: active.length,
      completed: completed.length,
      incomplete: incomplete.length,
      invalidated: invalidated.length,
    },
    eventStatus: settings?.status ?? 'DRAFT',
    effectiveStatus,
    closingDeadline: settings ? getClosingDeadline(settings) : null,
    closingRemainingSeconds: settings ? getClosingRemainingSeconds(settings, now) : 0,
    ranking: completed,
    active,
    incomplete,
    invalidated
  })
})
