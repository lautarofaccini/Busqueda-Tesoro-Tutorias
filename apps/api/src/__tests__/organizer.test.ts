import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { Unstable_DevWorker } from 'wrangler'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rmSync } from 'node:fs'

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
    'migrations/test_seed.sql'
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
      ORGANIZER_SECRET: 'super_secret'
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
      body: JSON.stringify({ passphrase: 'super_secret' })
    })
    expect(loginRes.status).toBe(200)
    const cookie = loginRes.headers.get('set-cookie')?.split(';')[0]
    expect(cookie).toBeTruthy()

    const res = await worker.fetch('/api/organizer/results', {
      headers: { cookie: cookie! }
    })
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.totals).toEqual({ all: 0, active: 0, completed: 0 })
    expect(data.ranking).toEqual([])
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
      body: JSON.stringify({ passphrase: 'super_secret' })
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
})
