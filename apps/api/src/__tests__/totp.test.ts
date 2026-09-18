import { describe, expect, it, vi } from 'vitest'
import { generateTotp, verifyTotp } from '../lib/totp.js'
import { isLoginRateLimited } from '../routes/organizer.js'

const SECRET = 'JBSWY3DPEHPK3PXP'
const NOW = 1_700_000_000_000

describe('organizer TOTP and rate-limit primitives', () => {
  it('accepts the current and one adjacent 30-second RFC 6238 window only', async () => {
    const current = await generateTotp(SECRET, NOW)
    const previous = await generateTotp(SECRET, NOW - 30_000)
    const outside = await generateTotp(SECRET, NOW - 60_000)
    await expect(verifyTotp(SECRET, current, NOW)).resolves.toBe(true)
    await expect(verifyTotp(SECRET, previous, NOW)).resolves.toBe(true)
    await expect(verifyTotp(SECRET, outside, NOW)).resolves.toBe(false)
    await expect(verifyTotp(SECRET, '12345', NOW)).resolves.toBe(false)
  })

  it('uses the rate-limit binding with a per-actor login key', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false })
    await expect(isLoginRateLimited({ limit } as unknown as RateLimit, '203.0.113.8')).resolves.toBe(true)
    expect(limit).toHaveBeenCalledWith({ key: 'organizer-login:203.0.113.8' })
  })
})
