/**
 * API integration tests — busqueda-tesoro-tutorias Phase 1
 *
 * Testing strategy:
 *   Uses wrangler's unstable_dev() to spin up a real Worker with Miniflare's
 *   local D1 (SQLite in-process). Migrations and seed are applied via
 *   child_process before the Worker starts.
 *
 *   Why unstable_dev over getPlatformProxy:
 *     - Tests the real Hono HTTP routing, middleware, cookie handling
 *     - Tests the full request/response cycle, not just DB logic
 *     - Miniflare's D1 is SQLite-compatible for all queries we use
 *
 *   Why NOT mocking:
 *     - Game logic is authoritative in the Worker; mocking it defeats the purpose
 *     - D1 query behavior must be validated (nullable fields, JSON parsing, etc.)
 *
 *   persist-to: uses a dedicated test directory (.wrangler/test-state)
 *   so tests never touch dev data.
 *
 * Wrangler version: 3.114.17
 * unstable_dev options verified from wrangler-dist/cli.d.ts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { Unstable_DevWorker } from 'wrangler'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rmSync } from 'node:fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const API_ROOT = join(__dirname, '..', '..') // apps/api
const REPO_ROOT = join(API_ROOT, '..', '..') // repo root

// Fixed test persist dir — isolated from dev state
const TEST_PERSIST = join(API_ROOT, '.wrangler', 'test-state')

// Demo tokens (fixed in seed_demo.sql — must match exactly)
const TOKEN_START = 'h7Xm2pL9qR3wK8nT'
const TOKEN_A = 'v4Nj6dF1mQ5yW2bG'
const TOKEN_B = 's9Kp8eA3cZ7xR4nL'
const TOKEN_UNKNOWN = 'XXXXXXXXXXXXXXXX'

let worker: Unstable_DevWorker

function applyMigrationsAndSeed() {
  // Wipe test DB completely so ALTER TABLEs don't fail on re-run
  rmSync(TEST_PERSIST, { recursive: true, force: true })

  // All wrangler commands run from apps/api where wrangler.toml lives
  const opts = { cwd: API_ROOT, stdio: 'pipe' as const }

  // Apply migrations via file (wrangler migrations apply doesn't support migrations_dir in binding in 3.x)
  execSync(
    `npx wrangler d1 execute busqueda-tesoro-db --local --persist-to="${TEST_PERSIST}" --file=../../migrations/0001_init.sql`,
    opts
  )
  execSync(
    `npx wrangler d1 execute busqueda-tesoro-db --local --persist-to="${TEST_PERSIST}" --file=../../migrations/0002_walking_skeleton.sql`,
    opts
  )

  // Apply seed
  execSync(
    `npx wrangler d1 execute busqueda-tesoro-db --local --persist-to="${TEST_PERSIST}" --file=../../migrations/seed_demo.sql`,
    opts
  )
}

beforeAll(async () => {
  applyMigrationsAndSeed()

  worker = await unstable_dev(join(API_ROOT, 'src', 'index.ts'), {
    local: true,
    persist: true,
    persistTo: TEST_PERSIST,
    experimental: {
      disableExperimentalWarning: true,
      d1Databases: [
        {
          binding: 'DB',
          database_name: 'busqueda-tesoro-db',
          // Must match the UUID in wrangler.toml so Miniflare finds the same SQLite file
          database_id: '00000000-0000-0000-0000-000000000001',
        },
      ],
    },
  })
}, 60_000)

afterAll(async () => {
  await worker?.stop()
})

// ── Helpers ─────────────────────────────────────────────────────────────────

async function scan(token: string, cookieHeader?: string) {
  return worker.fetch(`/api/scan/${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  })
}

async function startSession(playerName: string, startToken: string) {
  return worker.fetch('/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName, startToken }),
  })
}

async function submitAnswer(challengeId: number, answer: string, cookieHeader: string) {
  return worker.fetch(`/api/challenge/${challengeId}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieHeader,
    },
    body: JSON.stringify({ answer }),
  })
}

async function getGameState(cookieHeader: string) {
  return worker.fetch('/api/game/state', {
    headers: { cookie: cookieHeader },
  })
}

/** Extract the Set-Cookie header value from a response. */
function getCookieFromResponse(res: Response): string | null {
  return res.headers.get('set-cookie')
}

/** Extract the cookie name=value pair (for use as Cookie request header). */
function extractSessionCookie(setCookie: string): string {
  return setCookie.split(';')[0] ?? ''
}

// ── Health ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await worker.fetch('/health')
    expect(res.status).toBe(200)
    const body = await res.json() as { status: string }
    expect(body.status).toBe('ok')
  })
})

// ── Scan — no session ────────────────────────────────────────────────────────

describe('POST /api/scan/:token — no session', () => {
  it('start token without session → START_ALLOWED', async () => {
    const res = await scan(TOKEN_START)
    expect(res.status).toBe(200)
    const body = await res.json() as { state: string; startToken: string }
    expect(body.state).toBe('START_ALLOWED')
    expect(body.startToken).toBe(TOKEN_START)
  })

  it('non-start checkpoint without session → NEEDS_START', async () => {
    const res = await scan(TOKEN_A)
    expect(res.status).toBe(200)
    const body = await res.json() as { state: string }
    expect(body.state).toBe('NEEDS_START')
  })

  it('unknown token → generic NEEDS_START (no leak)', async () => {
    const res = await scan(TOKEN_UNKNOWN)
    expect(res.status).toBe(200)
    const body = await res.json() as { state: string }
    expect(body.state).toBe('NEEDS_START')
    // Must not contain any checkpoint information
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('checkpoint')
    expect(raw).not.toContain('label')
    expect(raw).not.toContain('id')
  })
})

// ── Session creation ─────────────────────────────────────────────────────────

describe('POST /api/session/start', () => {
  it('invalid startToken (non-start checkpoint) → 400', async () => {
    const res = await startSession('Test Player', TOKEN_A)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('INVALID_START_TOKEN')
  })

  it('unknown startToken → 400', async () => {
    const res = await startSession('Test Player', TOKEN_UNKNOWN)
    expect(res.status).toBe(400)
  })

  it('valid startToken creates session and returns ACTIVE with first clue', async () => {
    const res = await startSession('Ana', TOKEN_START)
    expect(res.status).toBe(201)
    const setCookie = getCookieFromResponse(res)
    expect(setCookie).not.toBeNull()
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')

    const body = await res.json() as { state: string; clue: string; stepNumber: number; totalSteps: number }
    expect(body.state).toBe('ACTIVE')
    expect(body.clue).toContain('[DEMO]')
    expect(body.stepNumber).toBe(1)  // first step
    expect(body.totalSteps).toBe(2)  // 2 demo steps total
  })

  it('Tutorías is not route step 1 — step 1 expects Demo A', async () => {
    // Start a session and verify step 1 = Demo A (not Tutorías)
    const startRes = await startSession('Carlos', TOKEN_START)
    const setCookie = getCookieFromResponse(startRes)!
    const cookie = extractSessionCookie(setCookie)

    // Session starts at step 1 → scanning Tutorías returns current state (not CHALLENGE)
    const reScanStart = await scan(TOKEN_START, cookie)
    const startState = await reScanStart.json() as { state: string }
    expect(startState.state).toBe('ACTIVE') // not CHALLENGE — start QR is not a challenge step

    // Demo A IS step 1
    const scanA = await scan(TOKEN_A, cookie)
    const bodyA = await scanA.json() as { state: string; stepNumber: number }
    expect(bodyA.state).toBe('CHALLENGE')
    expect(bodyA.stepNumber).toBe(1)
  })
})

// ── Challenge gate — must scan before answering ──────────────────────────────

describe('Challenge unlock gate', () => {
  async function setupSession(name: string) {
    const res = await startSession(name, TOKEN_START)
    const setCookie = getCookieFromResponse(res)!
    const cookie = extractSessionCookie(setCookie)
    return cookie
  }

  it('cannot submit answer before scanning checkpoint (unlocked_step=NULL → 403)', async () => {
    const cookie = await setupSession('Pedro')

    // Try to answer challenge 1 without scanning checkpoint A first
    // We need the challenge ID — get it by scanning A
    const scanARes = await scan(TOKEN_A, cookie)
    const { challengeId } = await scanARes.json() as { challengeId: number }

    // Reset: start a fresh session
    const cookie2 = await setupSession('Pedro2')

    // Attempt to answer before scanning
    const res = await submitAnswer(challengeId, 'naranja', cookie2)
    expect(res.status).toBe(403)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('CHALLENGE_NOT_UNLOCKED')
  })

  it('scanning expected checkpoint unlocks challenge', async () => {
    const cookie = await setupSession('María')
    const scanRes = await scan(TOKEN_A, cookie)
    const body = await scanRes.json() as { state: string; challengeId: number; question: string }
    expect(body.state).toBe('CHALLENGE')
    expect(typeof body.challengeId).toBe('number')
    expect(typeof body.question).toBe('string')
    expect(body.question.length).toBeGreaterThan(0)
  })

  it('refresh after scanning returns same CHALLENGE (restore state)', async () => {
    const cookie = await setupSession('Luis')
    await scan(TOKEN_A, cookie) // unlock challenge

    const stateRes = await getGameState(cookie)
    const body = await stateRes.json() as { state: string; challengeId: number }
    expect(body.state).toBe('CHALLENGE')
    expect(typeof body.challengeId).toBe('number')
  })

  it('rescanning same checkpoint returns same CHALLENGE (idempotent)', async () => {
    const cookie = await setupSession('Marta')
    const scan1 = await scan(TOKEN_A, cookie)
    const body1 = await scan1.json() as { state: string; challengeId: number }

    const scan2 = await scan(TOKEN_A, cookie)
    const body2 = await scan2.json() as { state: string; challengeId: number }

    expect(body1.state).toBe('CHALLENGE')
    expect(body2.state).toBe('CHALLENGE')
    expect(body1.challengeId).toBe(body2.challengeId)
  })
})

// ── Wrong checkpoint ─────────────────────────────────────────────────────────

describe('Wrong checkpoint', () => {
  it('scanning wrong checkpoint returns WRONG_CHECKPOINT without identity', async () => {
    const res = await startSession('Jorge', TOKEN_START)
    const cookie = extractSessionCookie(getCookieFromResponse(res)!)

    // Player at step 1 (expects A), scans B instead
    const wrongRes = await scan(TOKEN_B, cookie)
    expect(wrongRes.status).toBe(200)
    const body = await wrongRes.json() as Record<string, unknown>
    expect(body['state']).toBe('WRONG_CHECKPOINT')

    // Must not reveal checkpoint name, id, or token
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('DEMO_B')
    expect(raw).not.toContain(TOKEN_B)
    expect(raw).not.toContain('label')
    expect(raw).not.toContain('checkpoint_id')
    expect(raw).not.toContain('Checkpoint B')
  })
})

// ── Answer submission ────────────────────────────────────────────────────────

describe('Answer submission', () => {
  async function setupWithChallengeA() {
    const res = await startSession('Sofia', TOKEN_START)
    const cookie = extractSessionCookie(getCookieFromResponse(res)!)
    const scanRes = await scan(TOKEN_A, cookie)
    const { challengeId } = await scanRes.json() as { challengeId: number }
    return { cookie, challengeId }
  }

  it('wrong answer does not advance step', async () => {
    const { cookie, challengeId } = await setupWithChallengeA()

    const res = await submitAnswer(challengeId, 'azul', cookie)
    const body = await res.json() as { state: string; stepNumber: number }
    expect(body.state).toBe('ANSWER_INCORRECT')
    expect(body.stepNumber).toBe(1) // not advanced
  })

  it('wrong answer preserves unlocked_step (challenge still active)', async () => {
    const { cookie, challengeId } = await setupWithChallengeA()
    await submitAnswer(challengeId, 'wrong', cookie)

    // State should still be CHALLENGE for step 1
    const stateRes = await getGameState(cookie)
    const body = await stateRes.json() as { state: string; stepNumber: number }
    expect(body.state).toBe('CHALLENGE')
    expect(body.stepNumber).toBe(1)
  })

  it('correct answer advances to step 2 and returns ADVANCED', async () => {
    const { cookie, challengeId } = await setupWithChallengeA()

    const res = await submitAnswer(challengeId, 'naranja', cookie)
    const body = await res.json() as { state: string; stepNumber: number; clue: string }
    expect(body.state).toBe('ADVANCED')
    expect(body.stepNumber).toBe(2)
    expect(body.clue).toContain('[DEMO]')
  })

  it('correct answer advances exactly one step (no double-advance)', async () => {
    const { cookie, challengeId } = await setupWithChallengeA()
    await submitAnswer(challengeId, 'naranja', cookie)

    const stateRes = await getGameState(cookie)
    const body = await stateRes.json() as { state: string; stepNumber: number }
    expect(body.state).toBe('ACTIVE')
    expect(body.stepNumber).toBe(2) // exactly step 2, not 3
  })

  it('replay of step-1 challengeId after advancing is rejected', async () => {
    const { cookie, challengeId } = await setupWithChallengeA()
    await submitAnswer(challengeId, 'naranja', cookie) // advance to step 2

    // Replay old challenge ID → should be 403 CHALLENGE_NOT_CURRENT or CHALLENGE_NOT_UNLOCKED
    const replayRes = await submitAnswer(challengeId, 'naranja', cookie)
    expect([403]).toContain(replayRes.status)
    const body = await replayRes.json() as { error: string }
    expect(['CHALLENGE_NOT_CURRENT', 'CHALLENGE_NOT_UNLOCKED']).toContain(body.error)
  })
})

// ── Game completion ──────────────────────────────────────────────────────────

describe('Full game completion', () => {
  it('completing both steps marks session COMPLETED', async () => {
    // Step 1: start
    const startRes = await startSession('Valentina', TOKEN_START)
    const cookie = extractSessionCookie(getCookieFromResponse(startRes)!)

    // Step 2: scan A, answer correctly
    const scanA = await scan(TOKEN_A, cookie)
    const { challengeId: cA } = await scanA.json() as { challengeId: number }
    await submitAnswer(cA, 'naranja', cookie)

    // Step 3: scan B, answer correctly
    const scanB = await scan(TOKEN_B, cookie)
    const { challengeId: cB } = await scanB.json() as { challengeId: number }

    const finalRes = await submitAnswer(cB, '40', cookie)
    const body = await finalRes.json() as { state: string; playerName: string; completedAt: string }
    expect(body.state).toBe('COMPLETED')
    expect(body.playerName).toBe('Valentina')
    expect(typeof body.completedAt).toBe('string')
  })

  it('completed session stays COMPLETED on further GET /api/game/state', async () => {
    const startRes = await startSession('Roberto', TOKEN_START)
    const cookie = extractSessionCookie(getCookieFromResponse(startRes)!)

    const scanA = await scan(TOKEN_A, cookie)
    const { challengeId: cA } = await scanA.json() as { challengeId: number }
    await submitAnswer(cA, 'naranja', cookie)

    const scanB = await scan(TOKEN_B, cookie)
    const { challengeId: cB } = await scanB.json() as { challengeId: number }
    await submitAnswer(cB, '40', cookie)

    // Refresh
    const stateRes = await getGameState(cookie)
    const body = await stateRes.json() as { state: string }
    expect(body.state).toBe('COMPLETED')
  })

  it('completed session cannot be advanced by scanning again', async () => {
    const startRes = await startSession('Elena', TOKEN_START)
    const cookie = extractSessionCookie(getCookieFromResponse(startRes)!)

    const scanA = await scan(TOKEN_A, cookie)
    const { challengeId: cA } = await scanA.json() as { challengeId: number }
    await submitAnswer(cA, 'naranja', cookie)

    const scanB = await scan(TOKEN_B, cookie)
    const { challengeId: cB } = await scanB.json() as { challengeId: number }
    await submitAnswer(cB, '40', cookie)

    // Try to scan A again after completion
    const reScanRes = await scan(TOKEN_A, cookie)
    const body = await reScanRes.json() as { state: string }
    expect(body.state).toBe('COMPLETED')
  })

  it('alias "cuarenta" is accepted for challenge B', async () => {
    const startRes = await startSession('Nicolás', TOKEN_START)
    const cookie = extractSessionCookie(getCookieFromResponse(startRes)!)

    const scanA = await scan(TOKEN_A, cookie)
    const { challengeId: cA } = await scanA.json() as { challengeId: number }
    await submitAnswer(cA, 'naranja', cookie)

    const scanB = await scan(TOKEN_B, cookie)
    const { challengeId: cB } = await scanB.json() as { challengeId: number }

    const res = await submitAnswer(cB, 'cuarenta', cookie) // alias
    const body = await res.json() as { state: string }
    expect(body.state).toBe('COMPLETED')
  })
})

// ── Security contracts ────────────────────────────────────────────────────────

describe('Security contracts', () => {
  it('CHALLENGE response does not include accepted_answers', async () => {
    const startRes = await startSession('Security1', TOKEN_START)
    const cookie = extractSessionCookie(getCookieFromResponse(startRes)!)

    const scanRes = await scan(TOKEN_A, cookie)
    const body = await scanRes.json() as Record<string, unknown>
    expect(body['state']).toBe('CHALLENGE')

    expect(body).not.toHaveProperty('accepted_answers')
    expect(body).not.toHaveProperty('aliases')
    expect(body).not.toHaveProperty('canonicalAnswer')
    expect(body).not.toHaveProperty('answer')
  })

  it('CHALLENGE response does not include canonical answer', async () => {
    const startRes = await startSession('Security2', TOKEN_START)
    const cookie = extractSessionCookie(getCookieFromResponse(startRes)!)

    const scanRes = await scan(TOKEN_A, cookie)
    const body = await scanRes.json() as Record<string, unknown>
    
    // Check that we aren't leaking the answer array/object in the response
    expect(body).not.toHaveProperty('canonical')
    expect(body).not.toHaveProperty('accepted_answers')
    // We cannot do a strict string search for 'naranja' because it is in the Demo question text itself.
  })

  it('ACTIVE/ADVANCED response does not include future checkpoint tokens', async () => {
    const startRes = await startSession('Security3', TOKEN_START)
    const body = await startRes.json() as Record<string, unknown>
    const raw = JSON.stringify(body)
    // Should not contain any QR tokens
    expect(raw).not.toContain(TOKEN_A)
    expect(raw).not.toContain(TOKEN_B)
    expect(raw).not.toContain(TOKEN_START)
  })

  it('answer without session returns 401', async () => {
    const res = await worker.fetch('/api/challenge/1/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: 'naranja' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/game/state without session returns NEEDS_START', async () => {
    const res = await worker.fetch('/api/game/state')
    const body = await res.json() as { state: string }
    expect(body.state).toBe('NEEDS_START')
  })
})
