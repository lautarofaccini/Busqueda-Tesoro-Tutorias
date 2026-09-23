import type { ClosingGraceInfo } from '@busqueda-tesoro/shared'
import { parsePersistedUtc } from './timestamps.js'

export const CLOSING_GRACE_SECONDS = 30 * 60
const CLOSING_GRACE_MS = CLOSING_GRACE_SECONDS * 1000

export interface EventLifecycleSettings {
  status: string
  updated_at?: string | null
}

export type ExistingSessionLifecycle =
  | 'ALLOW'
  | 'EVENT_PAUSED'
  | 'EVENT_ENDED'
  | 'CLOSING_EXPIRED'
  | 'EVENT_NOT_LIVE'

export type SessionResultStatus = 'COMPLETED' | 'INCOMPLETE' | 'IN_PROGRESS'

export function getClosingDeadline(settings: EventLifecycleSettings): string | null {
  if (settings.status !== 'CLOSING') return null
  const startedAt = parsePersistedUtc(settings.updated_at)
  if (!Number.isFinite(startedAt)) return null
  return new Date(startedAt + CLOSING_GRACE_MS).toISOString()
}

export function getClosingRemainingSeconds(
  settings: EventLifecycleSettings,
  now = Date.now(),
): number {
  const deadline = getClosingDeadline(settings)
  if (!deadline) return 0
  return Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000))
}

export function isClosingGraceActive(
  settings: EventLifecycleSettings,
  now = Date.now(),
): boolean {
  const deadline = getClosingDeadline(settings)
  return deadline !== null && now < Date.parse(deadline)
}

export function getClosingGraceInfo(
  settings: EventLifecycleSettings,
  now = Date.now(),
): ClosingGraceInfo | null {
  const deadline = getClosingDeadline(settings)
  if (!deadline || !isClosingGraceActive(settings, now)) return null
  return {
    deadline,
    remainingSeconds: getClosingRemainingSeconds(settings, now),
  }
}

export function getEffectiveEventStatus(
  settings: EventLifecycleSettings,
  now = Date.now(),
): string {
  if (settings.status === 'CLOSING' && !isClosingGraceActive(settings, now)) return 'ENDED'
  return settings.status
}

export function getSessionResultStatus(sessionStatus: string, effectiveEventStatus: string): SessionResultStatus {
  if (sessionStatus === 'completed') return 'COMPLETED'
  return effectiveEventStatus === 'ENDED' ? 'INCOMPLETE' : 'IN_PROGRESS'
}

export function isCompetitiveCompletedSession(sessionStatus: string, invalidatedAt: unknown): boolean {
  return sessionStatus === 'completed' && !invalidatedAt
}

export function getExistingSessionLifecycle(
  settings: EventLifecycleSettings,
  now = Date.now(),
): ExistingSessionLifecycle {
  if (settings.status === 'LIVE') return 'ALLOW'
  if (settings.status === 'CLOSING') {
    return isClosingGraceActive(settings, now) ? 'ALLOW' : 'CLOSING_EXPIRED'
  }
  if (settings.status === 'PAUSED') return 'EVENT_PAUSED'
  if (settings.status === 'ENDED') return 'EVENT_ENDED'
  return 'EVENT_NOT_LIVE'
}

export function withClosingGrace<T extends object>(
  value: T,
  settings: EventLifecycleSettings,
  now = Date.now(),
): T & { closing?: ClosingGraceInfo } {
  const closing = getClosingGraceInfo(settings, now)
  return closing ? { ...value, closing } : value
}
