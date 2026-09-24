import { describe, expect, it, vi } from 'vitest'
import { timingSafeSecretEqual } from '../lib/auth.js'
import { isLoginRateLimited, organizerRoutes } from '../routes/organizer.js'

describe('organizer authentication primitives', () => {
  it('compares configured credentials without exposing their value', async () => {
    await expect(timingSafeSecretEqual('configured-secret', 'configured-secret')).resolves.toBe(true)
    await expect(timingSafeSecretEqual('configured-secret', 'wrong-secret')).resolves.toBe(false)
    await expect(timingSafeSecretEqual(undefined, 'anything')).resolves.toBe(false)
  })

  it('uses the rate-limit binding with a per-actor login key', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false })
    await expect(isLoginRateLimited({ limit } as unknown as RateLimit, '203.0.113.8')).resolves.toBe(true)
    expect(limit).toHaveBeenCalledWith({ key: 'organizer-login:203.0.113.8' })
  })

  it('returns 429 before credential verification when the limiter rejects an attempt', async () => {
    const response = await organizerRoutes.fetch(new Request('https://example.test/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.8' },
      body: JSON.stringify({ username: 'anything', password: 'anything' }),
    }), {
      ORGANIZER_SECRET: 'cookie-signing-secret',
      ADMIN_USERNAME: 'adminTutores21',
      ADMIN_PASSWORD: 'strong-password',
      PARTICIPANT_ID_SECRET: 'participant-secret',
      ADMIN_LOGIN_LIMITER: { limit: async () => ({ success: false }) } as unknown as RateLimit,
    })
    expect(response.status).toBe(429)
  })
})
