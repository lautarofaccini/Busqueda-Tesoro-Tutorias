import { describe, expect, it } from 'vitest'
import { durationSeconds, formatEventDateTime, formatEventTime, parsePersistedUtc } from '../eventTime'

describe('event timestamp handling', () => {
  it('interprets a D1 UTC timestamp and renders Argentina time', () => {
    expect(formatEventTime('2026-09-23 14:00:00')).toBe('11:00:00')
  })

  it('handles Argentina date rollover', () => {
    expect(formatEventDateTime('2026-09-23 01:30:00')).toContain('22/9/26')
    expect(formatEventTime('2026-09-23 01:30:00')).toBe('22:30:00')
  })

  it('does not double-convert timestamps that already carry UTC', () => {
    expect(parsePersistedUtc('2026-09-23T14:00:00.000Z').toISOString()).toBe('2026-09-23T14:00:00.000Z')
    expect(formatEventTime('2026-09-23T14:00:00.000Z')).toBe('11:00:00')
  })

  it('derives a fixed duration from persisted start and completion timestamps', () => {
    expect(durationSeconds('2026-09-23 14:00:00', '2026-09-23 14:09:37')).toBe(577)
  })
})
