import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getSignedCookie, setSignedCookie } from 'hono/cookie'
import type { Env } from '../env.d'
import { getOrganizerResults } from '../db/queries.js'
import { calculateScore } from '../lib/scoring.js'
import { timingSafeSecretEqual, verifyTotp } from '../lib/totp.js'


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

organizerRoutes.get('/results', async (c) => {
  const auth = await getSignedCookie(c, c.env.ORGANIZER_SECRET, AUTH_COOKIE)
  if (auth !== 'authenticated') {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }

  const rawResults = await getOrganizerResults(c.env.DB)
  let activeSessions = 0
  let completedSessions = 0

  const players = rawResults.map((r: any) => {
    // If invalidated, we don't count it towards competitive totals in the same way, but let's include it for the admin UI to see.
    if (!r.invalidatedAt) {
      if (r.status === 'completed') completedSessions++
      else if (r.status === 'active') activeSessions++
    }

    // Only compute score if completed
    let score = null
    let durationSec = null
    let needsReview = false
    
    if (r.status === 'completed' && r.completedAt) {
      score = calculateScore(r.correctCount, r.wrongCount, r.hintsUsed)
      const start = new Date(r.startedAt).getTime()
      const end = new Date(r.completedAt).getTime()
      durationSec = Math.floor((end - start) / 1000)
      
      if (durationSec < 300) {
        needsReview = true
      }
    }

    return {
      id: r.id, // Session ID
      participantId: r.participantId,
      playerName: r.playerName,
      identifierType: r.identifierType,
      identifierSuffix: r.identifierSuffix,
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
      needsReview
    }
  })

  // Ranking:
  // 1. Sort by score descending
  // 2. Tie groups are explicitly marked
  // Only completed sessions get a rank
  
  const completed = players
    .filter(p => p.status === 'completed' && !p.invalidatedAt)
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

  const active = players.filter(p => p.status !== 'completed' && !p.invalidatedAt)
  const invalidated = players.filter(p => p.invalidatedAt)
  // Display ordering purely, no rank
  active.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  return c.json({
    totals: {
      all: players.length,
      active: activeSessions,
      completed: completedSessions
    },
    ranking: completed,
    active,
    invalidated
  })
})
