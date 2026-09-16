/**
 * Typed API client — busqueda-tesoro-tutorias frontend.
 *
 * All requests go through /api/* which is proxied to the Worker in local dev.
 * In production, the Worker is on the same domain via Cloudflare routing.
 *
 * Session is carried via HttpOnly cookie — no manual header management needed.
 * credentials: 'include' ensures cookies are sent with every fetch.
 */
import type { GameState, SessionStartRequest, AnswerSubmitRequest } from '@busqueda-tesoro/shared'

const BASE = '' // same-origin — proxy handles routing in dev

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${url}`, {
    ...init,
    credentials: 'include', // send/receive HttpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body as Record<string, unknown>)
  }
  return response.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Record<string, unknown>
  ) {
    super(`API error ${status}`)
  }
}

/** GET /api/game/state — recover session state on page load / refresh. */
export async function getGameState(): Promise<GameState> {
  return apiFetch<GameState>('/api/game/state')
}

/** POST /api/session/start — create a new session from the start QR. */
export async function startSession(data: SessionStartRequest): Promise<GameState> {
  return apiFetch<GameState>('/api/session/start', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** POST /api/scan/:token — register a QR scan. */
export async function scanToken(token: string): Promise<GameState> {
  return apiFetch<GameState>(`/api/scan/${encodeURIComponent(token)}`, {
    method: 'POST',
  })
}

/** POST /api/challenge/:challengeId/answer — submit an answer. */
export async function submitAnswer(
  challengeId: number,
  data: AnswerSubmitRequest
): Promise<GameState> {
  return apiFetch<GameState>(`/api/challenge/${challengeId}/answer`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
