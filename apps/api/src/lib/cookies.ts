/**
 * Cookie utilities for the Cloudflare Worker.
 *
 * Session cookies:
 *   - HttpOnly: not accessible to JavaScript
 *   - SameSite=Lax: sent on same-site navigations and top-level cross-site GETs
 *   - Path=/: valid for all paths
 *   - Secure in production; omitted on localhost (http)
 *
 * Session ID is never placed in query strings, request bodies sent to the
 * client, or visible frontend state.
 */

const SESSION_COOKIE_NAME = 'gst' // "game session token" — opaque name

/** Parse the session token from the incoming Cookie header. */
export function getSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=')
    if (key?.trim() === SESSION_COOKIE_NAME) {
      return rest.join('=').trim() || null
    }
  }
  return null
}

/** Build a Set-Cookie header value for the session token. */
export function buildSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=86400', // 24 hours
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/** Build a clearing cookie (expires immediately). */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}

/** Determine if the request is local (localhost / 127.0.0.1) — no Secure flag there. */
export function isLocalRequest(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}
