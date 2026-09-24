import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { Unstable_DevWorker } from 'wrangler'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rmSync } from 'node:fs'

const here = fileURLToPath(new URL('.', import.meta.url))
const apiRoot = join(here, '..', '..')
const repoRoot = join(apiRoot, '..', '..')
const persistTo = join(apiRoot, '.wrangler', 'test-state-event-runs')
const wranglerCli = join(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const countSql = `SELECT
  (SELECT COUNT(*) FROM participants) AS participants,
  (SELECT COUNT(*) FROM sessions) AS sessions,
  (SELECT COUNT(*) FROM answer_attempts) AS answerAttempts,
  (SELECT COUNT(*) FROM scan_events) AS scanEvents,
  (SELECT COUNT(*) FROM session_challenge_assignments) AS assignments,
  (SELECT COUNT(*) FROM hint_usage) AS navigationHints,
  (SELECT COUNT(*) FROM question_hint_usage) AS questionHints,
  (SELECT COUNT(*) FROM answer_review_requests) AS answerReviews,
  (SELECT COUNT(*) FROM support_requests) AS supportRequests`

function executeLocalD1(args: string[]) {
  const output = execFileSync(process.execPath, [wranglerCli, 'd1', 'execute', 'busqueda-tesoro-db',
    '--local', `--persist-to=${persistTo}`, '--json', ...args], { cwd: apiRoot, encoding: 'utf8' })
  return JSON.parse(output) as Array<{ results: any[] }>
}

let migrationAudit: { before: Record<string, number>; after: Record<string, number>; foreignKeyViolations: any[]; ledgerSchemaObjects: string[] }

function prepareRealisticPreMigrationDatabase() {
  rmSync(persistTo, { recursive: true, force: true })
  const files = [
    ...Array.from({ length: 10 }, (_, index) => `migrations/${String(index + 1).padStart(4, '0')}_${[
      'init', 'walking_skeleton', 'question_pools', 'event_admin', 'participants_session_order',
      'checkpoint_clues', 'cooldown_and_career', 'production_scoring_and_review',
      'player_support_manual_review', 'remove_session_route_dependency',
    ][index]}.sql`),
    'seed/test_seed.sql', 'seed/organizer_observability_test.sql', 'seed/event_runs_migration_test.sql',
  ]
  for (const file of files) executeLocalD1(['--file', join(repoRoot, file)])
  const before = executeLocalD1(['--command', countSql])[0]!.results[0] as Record<string, number>
  executeLocalD1(['--file', join(repoRoot, 'migrations/0011_event_runs.sql')])
  const after = executeLocalD1(['--command', countSql])[0]!.results[0] as Record<string, number>
  const foreignKeyViolations = executeLocalD1(['--command', 'PRAGMA foreign_key_check'])[0]!.results
  const ledgerSchemaObjects = executeLocalD1(['--command', `SELECT name FROM sqlite_master
    WHERE name IN ('idx_score_adjustments_session','score_adjustments_no_update','score_adjustments_no_delete')
    ORDER BY name`])[0]!.results.map((row: any) => String(row.name))
  migrationAudit = { before, after, foreignKeyViolations, ledgerSchemaObjects }
}

let worker: Unstable_DevWorker
let cookie = ''

beforeAll(async () => {
  prepareRealisticPreMigrationDatabase()
  worker = await unstable_dev(join(apiRoot, 'src', 'index.ts'), {
    experimental: { disableExperimentalWarning: true }, local: true, persistTo,
    vars: { ORGANIZER_SECRET: 'super_secret', ADMIN_USERNAME: 'adminTutores21', ADMIN_PASSWORD: 'strong_test_password', PARTICIPANT_ID_SECRET: 'test_secret', ASSISTANCE_USERNAME: 'helper', ASSISTANCE_PASSWORD: 'helper_password' },
  })
  const login = await worker.fetch('/api/organizer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'adminTutores21', password: 'strong_test_password' }) })
  cookie = login.headers.get('set-cookie')!.split(';')[0]!
}, 90_000)

afterAll(async () => { if (worker) await worker.stop() })

describe('event editions and historical analytics', () => {
  it('backfills every historical session into Edition 1 without losing audit history', async () => {
    expect(migrationAudit.after).toEqual(migrationAudit.before)
    expect(migrationAudit.before).toMatchObject({ participants: 3, sessions: 3, answerAttempts: 8, answerReviews: 3 })
    expect(migrationAudit.foreignKeyViolations).toEqual([])
    expect(migrationAudit.ledgerSchemaObjects).toEqual([
      'idx_score_adjustments_session', 'score_adjustments_no_delete', 'score_adjustments_no_update',
    ])
    const runs = await (await worker.fetch('/api/organizer/runs', { headers: { cookie } })).json() as any
    expect(runs.runs).toHaveLength(1)
    expect(runs.runs[0]).toMatchObject({ id: 1, name: 'Edición 1 — 23/09/2026', participationCount: 3, isCurrent: true })

    const analytics = await (await worker.fetch('/api/organizer/runs/1/analytics', { headers: { cookie } })).json() as any
    expect(analytics.totals).toMatchObject({ all: 3, valid: 2, completed: 1, incomplete: 1, invalidated: 1, completionRate: 50 })
    expect(analytics.ranking).toHaveLength(1)
    expect(analytics.ranking[0]).toMatchObject({ id: 203, score: 300 })
    expect(analytics.questions.find((question: any) => question.questionId === 1)).toMatchObject({ received: 2, wrongAttempts: 2, hintUses: 1 })

    const detail = await (await worker.fetch('/api/organizer/players/203', { headers: { cookie } })).json() as any
    expect(detail.history.flatMap((item: any) => item.attempts)).toHaveLength(4)
  })

  it('requires authentication and repeated historical reads have no side effects', async () => {
    expect((await worker.fetch('/api/organizer/runs/1/analytics')).status).toBe(401)
    const first = await (await worker.fetch('/api/organizer/runs/1/analytics', { headers: { cookie } })).json()
    const second = await (await worker.fetch('/api/organizer/runs/1/analytics', { headers: { cookie } })).json()
    expect(second).toEqual(first)
  })

  it('applies append-only idempotent score corrections consistently and protects them from assistance users', async () => {
    const endpoint = '/api/organizer/players/203/score-adjustments'
    const correction = { amount: 10, reason: 'Reintegro de penalidad verificado por organización', idempotencyKey: 'score-test-203-refund-1' }
    expect((await worker.fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(correction) })).status).toBe(401)

    const created = await worker.fetch(endpoint, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(correction) })
    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({ score: 310, scoreBreakdown: { originalCalculatedScore: 300, manualAdjustmentTotal: 10, finalScore: 310 } })
    const repeated = await worker.fetch(endpoint, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(correction) })
    expect(repeated.status).toBe(200)
    expect(await repeated.json()).toMatchObject({ idempotent: true })

    const negative = await worker.fetch(endpoint, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: -5, reason: 'Compensación negativa documentada para prueba', idempotencyKey: 'score-test-203-negative-1' }) })
    expect(negative.status).toBe(201)
    const detail = await (await worker.fetch('/api/organizer/players/203', { headers: { cookie } })).json() as any
    expect(detail).toMatchObject({ score: 305, scoreBreakdown: { manualAdjustmentTotal: 5, finalScore: 305 }, auditStatus: 'PENDING' })
    expect(detail.scoreAdjustments).toHaveLength(2)

    const analytics = await (await worker.fetch('/api/organizer/runs/1/analytics', { headers: { cookie } })).json() as any
    expect(analytics.ranking[0]).toMatchObject({ id: 203, score: 305, manualAdjustmentTotal: 5, manualAdjustmentCount: 2 })
    expect(analytics.careers.find((career: any) => career.career === 'IEM')).toMatchObject({ totalScore: 305, averageScore: 305 })

    const reviewed = await worker.fetch('/api/organizer/players/203/audit-status', { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewed: true }) })
    expect(await reviewed.json()).toMatchObject({ auditStatus: 'REVIEWED' })

    const assistanceLogin = await worker.fetch('/api/assistance/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'helper', password: 'helper_password' }) })
    const assistanceCookie = assistanceLogin.headers.get('set-cookie')!.split(';')[0]!
    expect((await worker.fetch(endpoint, { method: 'POST', headers: { cookie: assistanceCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...correction, idempotencyKey: 'score-test-forbidden' }) })).status).toBe(401)
    expect((await worker.fetch(endpoint, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...correction, amount: 7, idempotencyKey: 'score-test-invalid' }) })).status).toBe(400)
  })

  it('creates a DRAFT edition without deleting history and scopes duplicate participation per edition', async () => {
    const before = await (await worker.fetch('/api/organizer/runs/1/analytics', { headers: { cookie } })).json() as any
    const created = await worker.fetch('/api/admin/event/runs', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true }) })
    expect(created.status).toBe(201)

    const settings = await (await worker.fetch('/api/admin/event', { headers: { cookie } })).json() as any
    expect(settings).toMatchObject({ status: 'DRAFT', current_event_run_id: 2 })
    const live = await worker.fetch('/api/admin/event', { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({
      status: 'LIVE', event_name: settings.event_name, points_per_correct: 777,
      wrong_answer_penalty: 12, hint_penalty: 6,
      minimum_expected_completion_minutes: settings.minimum_expected_completion_minutes,
    }) })
    expect(live.status).toBe(200)

    const registration = { playerName: 'Ana', lastName: 'Otra vez', career: 'ISI', identifierType: 'DNI', identifierValue: '12345678', startToken: 'h7Xm2pL9qR3wK8nT' }
    expect((await worker.fetch('/api/session/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registration) })).status).toBe(201)
    const duplicate = await worker.fetch('/api/session/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registration) })
    expect(duplicate.status).toBe(403)
    expect(await duplicate.json()).toMatchObject({ error: 'DUPLICATE_PARTICIPATION' })

    const after = await (await worker.fetch('/api/organizer/runs/1/analytics', { headers: { cookie } })).json() as any
    expect(after.totals).toEqual(before.totals)
    expect(after.ranking).toEqual(before.ranking)
    expect(after.ranking[0].score).toBe(305)
    const run2 = await (await worker.fetch('/api/organizer/runs/2/analytics', { headers: { cookie } })).json() as any
    expect(run2.totals.all).toBe(1)
  })

  it('keeps the destructive legacy reset unreachable', async () => {
    const response = await worker.fetch('/api/admin/reset', { method: 'POST', headers: { cookie } })
    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ error: 'LEGACY_RESET_DISABLED' })
  })
})
