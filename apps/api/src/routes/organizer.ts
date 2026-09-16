import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getSignedCookie, setSignedCookie } from 'hono/cookie'
import type { Env } from '../env.d'
import { getOrganizerResults, getRouteTotalSteps, getDefaultRoute } from '../db/queries.js'
import { calculateScore } from '../lib/scoring.js'
import { isLocalRequest } from '../lib/cookies.js'

export const organizerRoutes = new Hono<{ Bindings: Env }>()

const AUTH_COOKIE = 'organizer_auth'

// Simple MVP authentication
organizerRoutes.post(
  '/login',
  zValidator('json', z.object({ passphrase: z.string() }), (result, c) => {
    if (!result.success) return c.json({ error: 'INVALID_INPUT' }, 400)
  }),
  async (c) => {
    const { passphrase } = c.req.valid('json')
    if (passphrase !== c.env.ORGANIZER_SECRET) {
      return c.json({ error: 'UNAUTHORIZED' }, 401)
    }

    const secure = !isLocalRequest(c.req.url)
    await setSignedCookie(c, AUTH_COOKIE, 'authenticated', c.env.ORGANIZER_SECRET, {
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/api/organizer'
    })
    return c.json({ success: true })
  }
)

organizerRoutes.get('/results', async (c) => {
  const auth = await getSignedCookie(c, c.env.ORGANIZER_SECRET, AUTH_COOKIE)
  if (auth !== 'authenticated') {
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }

  const rawResults = await getOrganizerResults(c.env.DB)
  const defaultRoute = await getDefaultRoute(c.env.DB)
  const totalSteps = defaultRoute ? await getRouteTotalSteps(c.env.DB, defaultRoute.id) : 0

  let activeSessions = 0
  let completedSessions = 0

  const players = rawResults.map((r: any) => {
    if (r.status === 'completed') completedSessions++
    else if (r.status === 'active') activeSessions++

    // Only compute score if completed
    let score = null
    let durationSec = null
    let needsReview = false
    
    if (r.status === 'completed' && r.completedAt) {
      score = calculateScore(r.correctCount, r.wrongCount)
      const start = new Date(r.startedAt).getTime()
      const end = new Date(r.completedAt).getTime()
      durationSec = Math.floor((end - start) / 1000)
      
      // Suspicious duration: < 5 minutes (300 seconds) for a full hunt
      // This is configurable conceptually, for now hardcoded threshold
      if (durationSec < 300) {
        needsReview = true
      }
    }

    return {
      id: r.id,
      playerName: r.playerName,
      status: r.status,
      currentStep: r.currentStep,
      totalSteps,
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      durationSec,
      score,
      needsReview
    }
  })

  // Ranking:
  // 1. Sort by score descending
  // 2. Tie groups are explicitly marked
  // Only completed sessions get a rank
  
  const completed = players
    .filter(p => p.status === 'completed')
    .map(p => ({ ...p, rank: 0 }))
    
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

  const active = players.filter(p => p.status !== 'completed')
  // Display ordering purely, no rank
  active.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  return c.json({
    totals: {
      all: players.length,
      active: activeSessions,
      completed: completedSessions
    },
    ranking: completed,
    active
  })
})
