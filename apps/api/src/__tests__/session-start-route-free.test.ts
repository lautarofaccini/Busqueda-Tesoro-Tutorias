import { describe, expect, it, vi } from 'vitest'
import { createSession, cleanupFailedSessionStart } from '../db/queries.js'

function databaseForSessionStart(checkpointIds = [11, 12]) {
  const sql: string[] = []
  const batch = vi.fn(async () => [])
  const db = {
    prepare(query: string) {
      sql.push(query)
      const statement = {
        bind: () => statement,
        run: async () => ({ meta: { last_row_id: 77 } }),
        all: async () => ({ results: checkpointIds.map(id => ({ id })) }),
      }
      return statement
    },
    batch,
  } as unknown as D1Database
  return { db, sql, batch }
}

describe('route-free session initialization', () => {
  it('creates a session and persisted randomized destination snapshot without routes', async () => {
    const { db, sql } = databaseForSessionStart()

    await expect(createSession(db, {
      sessionToken: 'server-token',
      playerName: 'Ana Prueba',
      participantId: 4,
      eventRunId: 1,
    })).resolves.toBe(77)

    expect(sql[0]).toContain('INSERT INTO sessions')
    expect(sql.join('\n')).not.toMatch(/\broute_id\b|\bFROM routes\b|\broute_steps\b/i)
    expect(sql.filter(query => query.includes('INSERT INTO session_steps'))).toHaveLength(2)
  })

  it('compensates only the failed session and the participant created by that attempt', async () => {
    const { db, batch } = databaseForSessionStart()

    await cleanupFailedSessionStart(db, 77, 4)

    expect(batch).toHaveBeenCalledOnce()
    const statements = batch.mock.calls[0][0] as unknown[]
    expect(statements).toHaveLength(10)
  })

  it('never deletes an existing participant when initialization fails before session creation', async () => {
    const { db, batch } = databaseForSessionStart()

    await cleanupFailedSessionStart(db, null, null)

    expect(batch).not.toHaveBeenCalled()
  })
})
