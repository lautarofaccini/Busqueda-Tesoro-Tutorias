import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { z } from 'zod'
import type { Env } from '../env.d'
import { timingSafeSecretEqual } from '../lib/auth.js'
import { getAssistanceFeed, resolveAnswerReview, resolveSupportRequest } from '../lib/assistance.js'

export const assistanceRoutes = new Hono<{ Bindings: Env }>()
const COOKIE = 'assistance_auth'

export async function isAssistanceLoginRateLimited(limiter: RateLimit | undefined, actorKey: string) {
  if (!limiter) return false
  return !(await limiter.limit({ key: `assistance-login:${actorKey}` })).success
}

assistanceRoutes.post('/login', zValidator('json', z.object({ username: z.string(), password: z.string() })), async c => {
  const actorKey = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (await isAssistanceLoginRateLimited(c.env.ADMIN_LOGIN_LIMITER, actorKey)) return c.json({ error: 'RATE_LIMITED' }, 429)
  const input = c.req.valid('json')
  const [usernameValid, passwordValid] = await Promise.all([
    timingSafeSecretEqual(c.env.ASSISTANCE_USERNAME, input.username),
    timingSafeSecretEqual(c.env.ASSISTANCE_PASSWORD, input.password),
  ])
  if (!usernameValid || !passwordValid) return c.json({ error: 'UNAUTHORIZED' }, 401)
  await setSignedCookie(c, COOKIE, 'authenticated', c.env.ASSISTANCE_PASSWORD, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === 'production',
    sameSite: 'Strict',
    path: '/api/assistance',
    maxAge: 60 * 60 * 4,
  })
  return c.json({ success: true })
})

assistanceRoutes.post('/logout', async c => {
  deleteCookie(c, COOKIE, { path: '/api/assistance', secure: c.env.ENVIRONMENT === 'production' })
  return c.json({ success: true })
})

assistanceRoutes.use('*', async (c, next) => {
  const auth = await getSignedCookie(c, c.env.ASSISTANCE_PASSWORD, COOKIE)
  if (auth !== 'authenticated') return c.json({ error: 'UNAUTHORIZED' }, 401)
  await next()
})

assistanceRoutes.get('/feed', async c => c.json(await getAssistanceFeed(c.env.DB)))

assistanceRoutes.post('/reviews/:id/resolve', zValidator('json', z.object({ approve: z.boolean(), note: z.string().max(500).optional() })), async c => {
  const result = await resolveAnswerReview(c.env.DB, Number(c.req.param('id')), c.req.valid('json'))
  return c.json(result.body, result.status)
})

assistanceRoutes.post('/support/:id/resolve', zValidator('json', z.object({ note: z.string().max(500).optional() })), async c => {
  return c.json(await resolveSupportRequest(c.env.DB, Number(c.req.param('id')), c.req.valid('json').note))
})
