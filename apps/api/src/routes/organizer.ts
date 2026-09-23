import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getSignedCookie, setSignedCookie } from 'hono/cookie'
import type { Env } from '../env.d'
import { getOrganizerPlayerDetail, getOrganizerResults, getOrganizerStateSince } from '../db/queries.js'
import { calculateScore } from '../lib/scoring.js'
import { timingSafeSecretEqual, verifyTotp } from '../lib/totp.js'
import { deriveOperationalPlayerState } from '../lib/game-state.js'
import { parsePersistedUtc } from '../lib/timestamps.js'
import { getClosingDeadline, getClosingRemainingSeconds, getEffectiveEventStatus, getSessionResultStatus, isCompetitiveCompletedSession } from '../lib/event-lifecycle.js'


export const organizerRoutes = new Hono<{ Bindings: Env }>()

const AUTH_COOKIE = 'organizer_auth'

export async function isLoginRateLimited(limiter: RateLimit | undefined, actorKey: string): Promise<boolean> {
  if (!limiter) return false
  const result = await limiter.limit({ key: `organizer-login:${actorKey}` })
  return !result.success
}

organizerRoutes.post(
  '/login',
  zValidator('json', z.object({ passphrase: z.string(), totp: z.string() }), (result, c) => {
    if (!result.success) return c.json({ error: 'INVALID_INPUT' }, 400)
  }),
  async (c) => {
    const { passphrase, totp } = c.req.valid('json')
    // Cloudflare sets this trusted header at the edge. Do not trust client-supplied X-Forwarded-For.
    const actorKey = c.req.header('CF-Connecting-IP') ?? 'unknown'
    if (await isLoginRateLimited(c.env.ADMIN_LOGIN_LIMITER, actorKey)) return c.json({ error: 'RATE_LIMITED' }, 429)
    const [passwordValid, totpValid] = await Promise.all([
      timingSafeSecretEqual(c.env.ORGANIZER_SECRET, passphrase),
      verifyTotp(c.env.ORGANIZER_TOTP_SECRET, totp),
    ])
    if (!passwordValid || !totpValid) {
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
  return await getSignedCookie(c, c.env.ORGANIZER_SECRET, AUTH_COOKIE) === 'authenticated'
}

organizerRoutes.get('/players/:sessionId', async (c) => {
  if (!await hasOrganizerSession(c)) return c.json({ error: 'UNAUTHORIZED' }, 401)
  const sessionId = Number(c.req.param('sessionId'))
  if (!Number.isInteger(sessionId) || sessionId <= 0) return c.json({ error: 'INVALID_SESSION_ID' }, 400)
  const detail = await getOrganizerPlayerDetail(c.env.DB, sessionId)
  if (!detail) return c.json({ error: 'NOT_FOUND' }, 404)
  const settings = await c.env.DB.prepare('SELECT status, updated_at FROM event_settings WHERE id=1').first<any>()
  const effectiveStatus = settings ? getEffectiveEventStatus(settings) : 'DRAFT'
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
      score = calculateScore(r.correctCount, r.wrongCount, r.hintsUsed)
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
