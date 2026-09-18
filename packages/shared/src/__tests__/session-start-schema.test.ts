import { describe, expect, it } from 'vitest'
import { sessionStartSchema } from '../schemas.js'

const base = {
  playerName: 'Ana',
  lastName: 'Prueba',
  career: 'ISI',
  identifierType: 'LEGAJO' as const,
  identifierValue: '12345',
  startToken: 'opaque-start-token',
}

describe('session start registration validation', () => {
  it('accepts the supported career enum and correctly formatted identifiers', () => {
    for (const career of ['ISI', 'IEM', 'IQ', 'LAR', 'TEC']) {
      expect(sessionStartSchema.safeParse({ ...base, career }).success).toBe(true)
    }
    expect(sessionStartSchema.safeParse({ ...base, identifierType: 'DNI', identifierValue: '12345678' }).success).toBe(true)
  })

  it('rejects unknown careers and invalid legajo/DNI formats server-side', () => {
    expect(sessionStartSchema.safeParse({ ...base, career: 'OTRA' }).success).toBe(false)
    expect(sessionStartSchema.safeParse({ ...base, identifierValue: '1234' }).success).toBe(false)
    expect(sessionStartSchema.safeParse({ ...base, identifierValue: '12A45' }).success).toBe(false)
    expect(sessionStartSchema.safeParse({ ...base, identifierType: 'DNI', identifierValue: '1234567' }).success).toBe(false)
    expect(sessionStartSchema.safeParse({ ...base, identifierType: 'DNI', identifierValue: '1234567A' }).success).toBe(false)
  })
})
