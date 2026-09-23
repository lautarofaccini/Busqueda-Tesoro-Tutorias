import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { Unstable_DevWorker } from 'wrangler'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rmSync } from 'node:fs'
import { generateTotp } from '../lib/totp.js'

const TOTP_SECRET = 'JBSWY3DPEHPK3PXP'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const API_ROOT = join(__dirname, '..', '..') 
const REPO_ROOT = join(API_ROOT, '..', '..') 
const TEST_PERSIST = join(API_ROOT, '.wrangler', 'test-state-org')

function applyMigrationsAndSeed() {
  rmSync(TEST_PERSIST, { recursive: true, force: true })

  const wranglerCmd = `npx wrangler d1 execute busqueda-tesoro-db --local --persist-to=${TEST_PERSIST} --file=`
  const migrations = [
    'migrations/0001_init.sql',
    'migrations/0002_walking_skeleton.sql',
    'migrations/0003_question_pools.sql',
    'migrations/0004_event_admin.sql',
    'migrations/0005_participants_session_order.sql',
    'migrations/0006_checkpoint_clues.sql',
    'migrations/0007_cooldown_and_career.sql',
    'migrations/0008_production_scoring_and_review.sql',
    'migrations/0009_player_support_manual_review.sql',
    'migrations/0010_remove_session_route_dependency.sql',
    'seed/test_seed.sql',
    'seed/organizer_observability_test.sql'
  ]

  for (const file of migrations) {
    execSync(`${wranglerCmd}${join(REPO_ROOT, file)}`, { stdio: 'ignore' })
  }
}

let worker: Unstable_DevWorker

beforeAll(async () => {
  applyMigrationsAndSeed()

  worker = await unstable_dev(join(API_ROOT, 'src', 'index.ts'), {
    experimental: { disableExperimentalWarning: true },
    local: true,
    persistTo: TEST_PERSIST,
    vars: {
      ORGANIZER_SECRET: 'super_secret',
      ORGANIZER_TOTP_SECRET: TOTP_SECRET,
      PARTICIPANT_ID_SECRET: 'test_secret'
    }
  })
}, 30000)

afterAll(async () => {
  if (worker) {
    await worker.stop()
  }
})

describe('Organizer API', () => {
  it('rejects unauthorized access', async () => {
    const res = await worker.fetch('/api/organizer/results')
    expect(res.status).toBe(401)
  })

  it('accepts valid login and returns results', async () => {
    const loginRes = await worker.fetch('/api/organizer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: 'super_secret', totp: await generateTotp(TOTP_SECRET) })
    })
    expect(loginRes.status).toBe(200)
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0]
    expect(cookie).toBeTruthy()

    const res = await worker.fetch('/api/organizer/results', {
      headers: { cookie: cookie! }
    })
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.totals).toEqual({ all: 3, active: 2, completed: 1, incomplete: 0, invalidated: 0 })
    expect(data.ranking).toHaveLength(1)
    expect(data.active.map((player: any) => player.currentState).sort()).toEqual(['BUSCANDO_QR', 'RESPONDIENDO'])
  })

  it('returns read-only server-authoritative player detail for active and completed sessions', async () => {
    const loginRes = await worker.fetch('/api/organizer/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: 'super_secret', totp: await generateTotp(TOTP_SECRET) })
    })
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]!

    const answering = await (await worker.fetch('/api/organizer/players/201', { headers: { cookie } })).json() as any
    expect(answering).toMatchObject({ currentState: 'RESPONDIENDO', pendingReview: true, stateSince: '2026-09-23 14:02:00', stateSinceSource: 'CHECKPOINT_UNLOCK_SCAN' })
    expect(answering.currentQuestion).toMatchObject({ checkpoint: '[DEMO] Checkpoint A', question: '[DEMO] Ingres� la palabra naranja.' })
    expect(answering.history.find((item: any) => item.stepPosition === 1).attempts).toMatchObject([
      { answer: 'rojo', correct: false, reviewStatus: 'REJECTED' },
      { answer: 'azul', correct: false, reviewStatus: 'PENDING' },
    ])
    expect(answering.questionHints).toBe(1)

    const looking = await (await worker.fetch('/api/organizer/players/202', { headers: { cookie } })).json() as any
    expect(looking).toMatchObject({ currentState: 'BUSCANDO_QR', stateSince: '2026-09-23 14:05:00', stateSinceSource: 'SUCCESSFUL_ADVANCE' })
    expect(looking.destination).toMatchObject({ checkpoint: '[DEMO] Checkpoint A' })

    const completed = await (await worker.fetch('/api/organizer/players/203', { headers: { cookie } })).json() as any
    expect(completed).toMatchObject({ currentState: 'FINALIZADO', stateSince: '2026-09-23 14:10:00' })
    expect(completed.history.flatMap((item: any) => item.attempts).find((attempt: any) => attempt.answer === 'treinta')).toMatchObject({ reviewStatus: 'APPROVED', reviewCorrection: 10 })
  })

  it('requires organizer auth and repeated polling does not mutate session data', async () => {
    expect((await worker.fetch('/api/organizer/players/201')).status).toBe(401)
    const loginRes = await worker.fetch('/api/organizer/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: 'super_secret', totp: await generateTotp(TOTP_SECRET) })
    })
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]!
    const first = await (await worker.fetch('/api/organizer/players/201', { headers: { cookie } })).json()
    const second = await (await worker.fetch('/api/organizer/players/201', { headers: { cookie } })).json()
    expect(second).toEqual(first)
  })

  it('admin routes accept the same organizer auth cookie', async () => {
    // Missing cookie -> 401
    const noAuth = await worker.fetch('/api/admin/event')
    expect(noAuth.status).toBe(401)

    // Forged cookie -> 401
    const forged = await worker.fetch('/api/admin/event', {
      headers: { cookie: 'organizer_auth=forged_value' }
    })
    expect(forged.status).toBe(401)

    // Login correctly
    const loginRes = await worker.fetch('/api/organizer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: 'super_secret', totp: await generateTotp(TOTP_SECRET) })
    })
    expect(loginRes.status).toBe(200)

    const setCookie = loginRes.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    // Verify the path is correct
    expect(setCookie).toContain('Path=/api')

    const cookie = setCookie!.split(';')[0]
    
    // Valid cookie -> 200
    const res = await worker.fetch('/api/admin/event', {
      headers: { cookie }
    })
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.status).toBe('LIVE')
  })

  it('requires both password and a well-formed TOTP code, and logs out', async () => {
    const validCode = await generateTotp(TOTP_SECRET)
    for (const body of [
      { passphrase: 'wrong', totp: validCode },
      { passphrase: 'super_secret', totp: '000000' },
      { passphrase: 'super_secret', totp: 'not-a-code' },
    ]) {
      const response = await worker.fetch('/api/organizer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      expect(response.status).toBe(401)
      expect(JSON.stringify(await response.json())).not.toContain(TOTP_SECRET)
    }
    const login = await worker.fetch('/api/organizer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase: 'super_secret', totp: validCode }) })
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!
    const logout = await worker.fetch('/api/organizer/logout', { method: 'POST', headers: { cookie } })
    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
  })

})
