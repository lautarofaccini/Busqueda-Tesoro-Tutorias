/** D1 datetime('now') values are UTC but omit an offset. */
export function parsePersistedUtc(value: string | null | undefined): number {
  if (!value) return Number.NaN
  const explicit = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const normalized = explicit ? value : `${value.replace(' ', 'T')}Z`
  return Date.parse(normalized)
}
