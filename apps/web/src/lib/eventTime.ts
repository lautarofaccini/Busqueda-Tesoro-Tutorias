export const EVENT_TIME_ZONE = 'America/Argentina/Buenos_Aires'

/** SQLite datetime('now') stores UTC as `YYYY-MM-DD HH:mm:ss` without a suffix. */
export function parsePersistedUtc(value: string): Date {
  const explicit = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  return new Date(explicit ? value : `${value.replace(' ', 'T')}Z`)
}

export function formatEventTime(value: string, withSeconds = true): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: EVENT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(parsePersistedUtc(value))
}

export function formatEventDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: EVENT_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  }).format(parsePersistedUtc(value))
}

export function elapsedSeconds(value: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - parsePersistedUtc(value).getTime()) / 1000))
}

export function durationSeconds(start: string, end: string): number {
  return Math.max(0, Math.floor((parsePersistedUtc(end).getTime() - parsePersistedUtc(start).getTime()) / 1000))
}

export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  const two = (part: number) => String(part).padStart(2, '0')
  return hours > 0 ? `${two(hours)}:${two(minutes)}:${two(remainder)}` : `${two(minutes)}:${two(remainder)}`
}
