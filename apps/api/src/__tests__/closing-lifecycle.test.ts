import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../env.d'
import { sessionRoutes } from '../routes/session.js'
import { scanRoutes } from '../routes/scan.js'
import { gameRoutes } from '../routes/game.js'
import { answerRoutes } from '../routes/answer.js'
import { supportRoutes } from '../routes/support.js'
import { resolveAnswerReview } from '../lib/assistance.js'
import { EVENT_SETTINGS_UPDATE_SQL, updateEventSettings } from '../routes/admin.js'
import {
  getClosingDeadline,
  getClosingRemainingSeconds,
  getEffectiveEventStatus,
  getSessionResultStatus,
  isCompetitiveCompletedSession,
  isClosingGraceActive,
} from '../lib/event-lifecycle.js'

const STARTED_AT = '2026-09-23 18:00:00'
const BEFORE_DEADLINE = Date.parse('2026-09-23T18:29:59Z')
const AT_DEADLINE = Date.parse('2026-09-23T18:30:00Z')

type DbOptions = {
  unlockedStep?: number | null
  checkpointStart?: boolean
  answer?: string
  review?: boolean
  sessionStatus?: 'active' | 'completed'
}

function closingDb(options: DbOptions = {}) {
  const writes: string[] = []
  const settings = { id: 1, status: 'CLOSING', updated_at: STARTED_AT, points_per_correct: 100, wrong_answer_penalty: 10, hint_penalty: 5 }
  const session = { id: 7, session_token: 'existing', player_name: 'Ana', current_step: 1, status: options.sessionStatus ?? 'active', unlocked_step: options.unlockedStep === undefined ? 1 : options.unlockedStep, started_at: STARTED_AT, completed_at: options.sessionStatus === 'completed' ? '2026-09-23 18:10:00' : null }
  const checkpoint = { id: options.checkpointStart ? 1 : 2, token: options.checkpointStart ? 'start' : 'next', sequence_order: 1, label: 'Punto', is_start: options.checkpointStart ? 1 : 0 }
  const challenge = { id: 10, checkpoint_id: 2, question_text: 'Pregunta', accepted_answers: JSON.stringify(['correcta']), hint_text: 'Pista', active: 1 }

  const db = {
    prepare(sql: string) {
      let args: unknown[] = []
      const statement = {
        bind: (...values: unknown[]) => { args = values; return statement },
        first: async () => {
          if (sql.includes('FROM event_settings')) return settings
          if (sql.includes('FROM checkpoints WHERE token') || sql.includes('fallback_code')) return checkpoint
          if (sql.includes('FROM sessions WHERE session_token')) return session
          if (sql.includes('SELECT status FROM sessions WHERE id=')) return { status: session.status }
          if (sql.includes('COUNT(*) as cnt FROM session_steps')) return { cnt: 1 }
          if (sql.includes('FROM session_steps WHERE session_id')) return { id: 1, session_id: 7, position: 1, checkpoint_id: 2, primary_clue: 'Pista de recorrido', secondary_clue: 'Pista extra', instruction: null }
          if (sql.includes('JOIN session_challenge_assignments')) return challenge
          if (sql.includes('correct_count')) return { correct_count: 0, wrong_count: 0, hint_count: 0, manual_correct_count: 0, reversed_wrong_count: 0 }
          if (sql.includes('count(*) as c FROM answer_attempts')) return { c: 1 }
          if (sql.includes('ORDER BY id DESC LIMIT 1')) return null
          if (sql.includes('SELECT 1 FROM question_hint_usage')) return null
          if (sql.includes('SELECT 1 FROM hint_usage')) return null
          if (sql.includes('SELECT 1 FROM answer_attempts') && sql.includes('correct = 0')) return { found: 1 }
          if (sql.includes('FROM support_requests')) return null
          if (sql.includes('FROM answer_attempts WHERE id')) return { id: 31, challenge_id: 10, raw_answer: options.answer ?? 'respuesta' }
          if (sql.includes('SELECT checkpoint_id FROM challenges')) return { checkpoint_id: 2 }
          if (sql.includes('SELECT * FROM answer_review_requests')) return options.review ? { id: 41, status: 'PENDING', session_id: 7, challenge_id: 10, normalized_answer: 'respuesta' } : null
          return null
        },
        all: async () => ({ results: [] }),
        run: async () => {
          writes.push(`${sql} :: ${JSON.stringify(args)}`)
          return { meta: { last_row_id: 99 } }
        },
      }
      return statement
    },
    batch: async () => [],
  } as unknown as D1Database
  return { db, writes }
}

function appFor(path: string, routes: any) {
  const app = new Hono<{ Bindings: Env }>()
  app.route(path, routes)
  return app
}

const env = (db: D1Database) => ({ DB: db, ENVIRONMENT: 'development', PARTICIPANT_ID_SECRET: 'secret' }) as Env

afterEach(() => vi.restoreAllMocks())

describe('CLOSING grace lifecycle', () => {
  const settings = { status: 'CLOSING', updated_at: STARTED_AT }

  it('uses updated_at as the exact 30-minute UTC deadline', () => {
    expect(getClosingDeadline(settings)).toBe('2026-09-23T18:30:00.000Z')
    expect(isClosingGraceActive(settings, BEFORE_DEADLINE)).toBe(true)
    expect(getClosingRemainingSeconds(settings, BEFORE_DEADLINE)).toBe(1)
    expect(isClosingGraceActive(settings, AT_DEADLINE)).toBe(false)
    expect(getClosingRemainingSeconds(settings, AT_DEADLINE)).toBe(0)
    expect(getEffectiveEventStatus(settings, AT_DEADLINE)).toBe('ENDED')
  })

  it('classifies unfinished sessions as incomplete only after effective end', () => {
    expect(getSessionResultStatus('active', 'CLOSING')).toBe('IN_PROGRESS')
    expect(getSessionResultStatus('active', 'ENDED')).toBe('INCOMPLETE')
    expect(getSessionResultStatus('completed', 'ENDED')).toBe('COMPLETED')
    const sessions = [{ status: 'active', invalidatedAt: null }, { status: 'completed', invalidatedAt: null }]
    expect(sessions).toHaveLength(2)
    expect(sessions.filter(item => isCompetitiveCompletedSession(item.status, item.invalidatedAt))).toHaveLength(1)
    expect(isCompetitiveCompletedSession('active', null)).toBe(false)
    expect(isCompetitiveCompletedSession('completed', '2026-09-23 18:10:00')).toBe(false)
  })

  it('preserves updated_at atomically when CLOSING is saved again', async () => {
    let capturedArgs: unknown[] = []
    const db = {
      prepare(sql: string) {
        expect(sql).toBe(EVENT_SETTINGS_UPDATE_SQL)
        const statement = {
          bind: (...args: unknown[]) => { capturedArgs = args; return statement },
          run: async () => ({ success: true }),
        }
        return statement
      },
    } as unknown as D1Database
    await updateEventSettings(db, {
      status: 'CLOSING', event_name: 'Evento', points_per_correct: 100,
      wrong_answer_penalty: 10, hint_penalty: 5, minimum_expected_completion_minutes: 10,
    })
    expect(EVENT_SETTINGS_UPDATE_SQL).toContain("WHEN status = 'CLOSING' AND ? = 'CLOSING' THEN updated_at")
    expect(capturedArgs.slice(0, 2)).toEqual(['CLOSING', 'CLOSING'])
  })

  it('blocks session creation before any participant/session write', async () => {
    const { db, writes } = closingDb({ checkpointStart: true })
    const response = await appFor('/api/session', sessionRoutes).request('/api/session/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Ana', lastName: 'Prueba', career: 'ISI', identifierType: 'DNI', identifierValue: '12345678', startToken: 'start' }),
    }, env(db))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ state: 'REGISTRATION_CLOSED' })
    expect(writes).toHaveLength(0)
  })

  it.each([
    ['/api/scan/start', scanRoutes, undefined],
    ['/api/support/fallback-code', supportRoutes, JSON.stringify({ code: 'START' })],
  ])('blocks the START entry flow at %s', async (url, routes, body) => {
    const { db, writes } = closingDb({ checkpointStart: true })
    const response = await appFor(url.startsWith('/api/scan') ? '/api/scan' : '/api/support', routes).request(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, ...(body ? { body } : {}),
    }, env(db))
    expect(await response.json()).toMatchObject({ state: 'REGISTRATION_CLOSED' })
    expect(writes).toHaveLength(0)
  })

  it('lets an existing session recover state at 29:59 with server grace metadata', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BEFORE_DEADLINE)
    const { db } = closingDb({ unlockedStep: null })
    const response = await appFor('/api/game', gameRoutes).request('/api/game/state', { headers: { cookie: 'gst=existing' } }, env(db))
    expect(await response.json()).toMatchObject({ state: 'ACTIVE', closing: { deadline: '2026-09-23T18:30:00.000Z', remainingSeconds: 1 } })
  })

  it('allows the expected checkpoint scan during grace and blocks it at the boundary', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BEFORE_DEADLINE)
    const allowed = closingDb({ unlockedStep: null })
    const allowedResponse = await appFor('/api/scan', scanRoutes).request('/api/scan/next', { method: 'POST', headers: { cookie: 'gst=existing' } }, env(allowed.db))
    expect(await allowedResponse.json()).toMatchObject({ state: 'CHALLENGE', closing: { remainingSeconds: 1 } })
    expect(allowed.writes.some(sql => sql.includes('UPDATE sessions SET unlocked_step'))).toBe(true)

    vi.restoreAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(AT_DEADLINE)
    const blocked = closingDb({ unlockedStep: null })
    const blockedResponse = await appFor('/api/scan', scanRoutes).request('/api/scan/next', { method: 'POST', headers: { cookie: 'gst=existing' } }, env(blocked.db))
    expect(await blockedResponse.json()).toEqual({ state: 'CLOSING_EXPIRED' })
    expect(blocked.writes).toHaveLength(0)
  })

  it('blocks state recovery exactly at 30:00 without mutating the session', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(AT_DEADLINE)
    const { db, writes } = closingDb()
    const response = await appFor('/api/game', gameRoutes).request('/api/game/state', { headers: { cookie: 'gst=existing' } }, env(db))
    expect(await response.json()).toEqual({ state: 'CLOSING_EXPIRED' })
    expect(writes).toHaveLength(0)
  })

  it('keeps an already completed session accessible after the grace deadline', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(AT_DEADLINE)
    const { db } = closingDb({ sessionStatus: 'completed' })
    const response = await appFor('/api/game', gameRoutes).request('/api/game/state', { headers: { cookie: 'gst=existing' } }, env(db))
    expect(await response.json()).toMatchObject({ state: 'COMPLETED', playerName: 'Ana' })
  })

  it('allows wrong answers during grace and blocks them at the deadline before logging', async () => {
    const makeRequest = async (now: number) => {
      vi.spyOn(Date, 'now').mockReturnValue(now)
      const fixture = closingDb({ unlockedStep: 1 })
      const response = await appFor('/api/challenge', answerRoutes).request('/api/challenge/10/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie: 'gst=existing' }, body: JSON.stringify({ answer: 'incorrecta', clientNow: '2026-09-23T18:00:00Z' }),
      }, env(fixture.db))
      return { body: await response.json() as any, writes: fixture.writes }
    }
    const allowed = await makeRequest(BEFORE_DEADLINE)
    expect(allowed.body.state).toBe('ANSWER_INCORRECT')
    expect(allowed.writes.some(sql => sql.includes('INSERT INTO answer_attempts'))).toBe(true)
    vi.restoreAllMocks()
    const blocked = await makeRequest(AT_DEADLINE)
    expect(blocked.body.state).toBe('CLOSING_EXPIRED')
    expect(blocked.writes).toHaveLength(0)
  })

  it('completes a session normally when the final correct answer arrives during grace', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BEFORE_DEADLINE)
    const { db, writes } = closingDb({ unlockedStep: 1 })
    const response = await appFor('/api/challenge', answerRoutes).request('/api/challenge/10/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: 'gst=existing' }, body: JSON.stringify({ answer: 'correcta' }),
    }, env(db))
    expect(await response.json()).toMatchObject({ state: 'COMPLETED', playerName: 'Ana' })
    expect(writes.some(sql => sql.includes("SET status = 'completed'"))).toBe(true)
  })

  it('allows both hint types, support, and review requests during grace', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BEFORE_DEADLINE)

    const secondary = closingDb({ unlockedStep: null })
    expect((await (await appFor('/api/game', gameRoutes).request('/api/game/secondary-hint', { method: 'POST', headers: { cookie: 'gst=existing' } }, env(secondary.db))).json() as any).state).toBe('ACTIVE')
    expect(secondary.writes.some(sql => sql.includes('hint_usage'))).toBe(true)

    const question = closingDb({ unlockedStep: 1 })
    expect((await (await appFor('/api/game', gameRoutes).request('/api/game/question-hint', { method: 'POST', headers: { cookie: 'gst=existing' } }, env(question.db))).json() as any).state).toBe('CHALLENGE')
    expect(question.writes.some(sql => sql.includes('question_hint_usage'))).toBe(true)

    const support = closingDb({ unlockedStep: null })
    expect((await (await appFor('/api/support', supportRoutes).request('/api/support/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: 'gst=existing' }, body: JSON.stringify({ category: 'OTHER' }) }, env(support.db))).json() as any).success).toBe(true)

    const review = closingDb({ unlockedStep: 1 })
    expect((await (await appFor('/api/support', supportRoutes).request('/api/support/answer-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: 'gst=existing' }, body: JSON.stringify({ attemptId: 31 }) }, env(review.db))).json() as any).success).toBe(true)
  })

  it('blocks hint, support, and review mutations after the deadline', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(AT_DEADLINE)
    const targets = [
      { routes: gameRoutes, base: '/api/game', url: '/api/game/question-hint', body: undefined },
      { routes: supportRoutes, base: '/api/support', url: '/api/support/requests', body: JSON.stringify({ category: 'OTHER' }) },
      { routes: supportRoutes, base: '/api/support', url: '/api/support/answer-reviews', body: JSON.stringify({ attemptId: 31 }) },
    ]
    for (const target of targets) {
      const { db, writes } = closingDb({ unlockedStep: 1 })
      const response = await appFor(target.base, target.routes).request(target.url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: 'gst=existing' }, ...(target.body ? { body: target.body } : {}) }, env(db))
      expect(await response.json()).toMatchObject({ state: 'CLOSING_EXPIRED' })
      expect(writes).toHaveLength(0)
    }
  })

  it('allows organizer review reconciliation during grace but not after expiry', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(BEFORE_DEADLINE)
    const allowed = closingDb({ review: true })
    expect(await resolveAnswerReview(allowed.db, 41, { approve: false })).toMatchObject({ status: 200, body: { status: 'REJECTED' } })
    expect(allowed.writes.some(sql => sql.includes("status='REJECTED'"))).toBe(true)

    vi.restoreAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(AT_DEADLINE)
    const blocked = closingDb({ review: true })
    expect(await resolveAnswerReview(blocked.db, 41, { approve: false })).toMatchObject({ status: 409, body: { state: 'CLOSING_EXPIRED' } })
    expect(blocked.writes).toHaveLength(0)
  })
})
