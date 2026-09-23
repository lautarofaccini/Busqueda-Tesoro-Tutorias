import { describe, expect, it, vi } from 'vitest'
import { assistanceRoutes, isAssistanceLoginRateLimited } from '../routes/assistance.js'
import { adminRoutes } from '../routes/admin.js'
import { organizerRoutes } from '../routes/organizer.js'

const env = {
  ASSISTANCE_USERNAME: 'tutor',
  ASSISTANCE_PASSWORD: 'clave-segura',
  ORGANIZER_SECRET: 'organizer-only',
  ORGANIZER_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
  PARTICIPANT_ID_SECRET: 'participant-only',
  ENVIRONMENT: 'production',
  DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } as unknown as D1Database,
}

describe('limited assistance authentication', () => {
  it('accepts valid shared credentials and issues a bounded hardened cookie', async () => {
    const response = await assistanceRoutes.fetch(new Request('https://example.test/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'tutor', password: 'clave-segura' }) }), env)
    expect(response.status).toBe(200)
    const cookie = response.headers.get('set-cookie')!
    expect(cookie).toContain('assistance_auth=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Max-Age=14400')
    expect(cookie).toContain('Path=/api/assistance')
    const authCookie = cookie.split(';')[0]!
    const logout = await assistanceRoutes.fetch(new Request('https://example.test/logout', { method: 'POST', headers: { cookie: authCookie } }), env)
    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('rejects invalid credentials and invokes a per-actor limiter', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false })
    await expect(isAssistanceLoginRateLimited({ limit } as unknown as RateLimit, '203.0.113.10')).resolves.toBe(true)
    expect(limit).toHaveBeenCalledWith({ key: 'assistance-login:203.0.113.10' })
    const invalid = await assistanceRoutes.fetch(new Request('https://example.test/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'tutor', password: 'incorrecta' }) }), env)
    expect(invalid.status).toBe(401)
  })

  it('allows the assistance feed but its cookie cannot authorize organizer mutations', async () => {
    const login = await assistanceRoutes.fetch(new Request('https://example.test/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'tutor', password: 'clave-segura' }) }), env)
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!
    const feed = await assistanceRoutes.fetch(new Request('https://example.test/feed', { headers: { cookie } }), env)
    expect(feed.status).toBe(200)
    for (const request of [
      new Request('https://example.test/event', { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: '{}' }),
      new Request('https://example.test/checkpoints/1/token', { method: 'POST', headers: { cookie } }),
      new Request('https://example.test/challenges/1', { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: '{}' }),
    ]) expect((await adminRoutes.fetch(request, env)).status).toBe(401)
    expect((await organizerRoutes.fetch(new Request('https://example.test/players/1', { headers: { cookie } }), env)).status).toBe(401)
  })
})
