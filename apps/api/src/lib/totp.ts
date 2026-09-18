const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const encoder = new TextEncoder()

function decodeBase32(secret: string): Uint8Array | null {
  const normalized = secret.replace(/[\s-]/g, '').toUpperCase().replace(/=+$/, '')
  if (!normalized) return null

  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index < 0) return null
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return bytes.length ? new Uint8Array(bytes) : null
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index++) difference |= left[index]! ^ right[index]!
  return difference === 0
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const counterBytes = new Uint8Array(8)
  let remaining = counter
  for (let index = 7; index >= 0; index--) {
    counterBytes[index] = remaining & 0xff
    remaining = Math.floor(remaining / 256)
  }
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes))
  const offset = digest[digest.length - 1]! & 0x0f
  const code = ((digest[offset]! & 0x7f) << 24) | (digest[offset + 1]! << 16) | (digest[offset + 2]! << 8) | digest[offset + 3]!
  return String(code % 1_000_000).padStart(6, '0')
}

export async function generateTotp(secretValue: string, now = Date.now()): Promise<string> {
  const secret = decodeBase32(secretValue)
  if (!secret) throw new Error('Invalid TOTP secret')
  return hotp(secret, Math.floor(now / 1000 / 30))
}

/** RFC 6238, SHA-1, 30-second period, six digits. Accepts one adjacent window. */
export async function verifyTotp(secretValue: string | undefined, code: string, now = Date.now(), window = 1): Promise<boolean> {
  if (!secretValue || !/^\d{6}$/.test(code)) return false
  const secret = decodeBase32(secretValue)
  if (!secret) return false
  const counter = Math.floor(now / 1000 / 30)
  const supplied = encoder.encode(code)
  for (let step = -window; step <= window; step++) {
    const expected = encoder.encode(await hotp(secret, counter + step))
    if (timingSafeEqual(expected, supplied)) return true
  }
  return false
}

/** Timing-safe comparison for fixed, SHA-256-derived credential digests. */
export async function timingSafeSecretEqual(expected: string | undefined, supplied: string): Promise<boolean> {
  if (!expected) return false
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
  ])
  return timingSafeEqual(new Uint8Array(expectedHash), new Uint8Array(suppliedHash))
}
