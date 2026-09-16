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
const TEST_PERSIST = join(API_ROOT, '.wrangler', 'test-state-scoring')

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
    'migrations/test_seed.sql'
  ]
  for (const file of migrations) {
    execSync(`${wranglerCmd}${join(REPO_ROOT, file)}`, { stdio: 'ignore' })
  }
}

let worker: Unstable_DevWorker
let cookieAuth: string

const TOKEN_START = 'h7Xm2pL9qR3wK8nT'
const TOKEN_A = 'v4Nj6dF1mQ5yW2bG'
const TOKEN_B = 's9Kp8eA3cZ7xR4nL'
const TOKEN_C = 'j2Ym5cN8qW4vH7rT'
const TOKEN_D = 'f6Xj9kL2pM5yR3bN'

const DEMO_ANSWERS: Record<number, { canonical: string; wrong: string }> = {
  1: { canonical: 'naranja', wrong: 'rojo' },
  2: { canonical: 'tutorias', wrong: 'rojo' },
  3: { canonical: '25', wrong: 'rojo' },
  4: { canonical: '40', wrong: 'rojo' },
  5: { canonical: 'final', wrong: 'rojo' },
  6: { canonical: 'exito', wrong: 'rojo' },
}

async function play(playerName: string, wrongCountA: number, wrongCountB: number, delayMs: number = 0) {
  // Start session
  let res = await worker.fetch('/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName, identifierType: 'LEGAJO', identifierValue: playerName + Math.floor(Math.random() * 10000), startToken: TOKEN_START })
  })
  const cookie = res.headers.get('set-cookie')?.split(';')[0]!

  // Step 1

  const tokens = [TOKEN_A, TOKEN_B, TOKEN_C, TOKEN_D];
  let scanRes, b;
  let currentToken;
  for (const t of tokens) {
    scanRes = await worker.fetch(`/api/scan/${t}`, { method: 'POST', headers: { cookie } });
    b = await scanRes.json();
    if (b.state === 'CHALLENGE') {
      currentToken = t;
      break;
    }
  }
  if (b.state !== 'CHALLENGE') throw new Error('Step 1 failed to unlock: ' + JSON.stringify(b));
  let challengeId = b.challengeId;

  for (let i = 0; i < wrongCountA; i++) {
    await worker.fetch(`/api/challenge/${challengeId}/answer`, {
      method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: DEMO_ANSWERS[challengeId].wrong })
    })
  }
  
  if (delayMs > 0) {
    await new Promise(r => setTimeout(r, delayMs))
  }

  await worker.fetch(`/api/challenge/${challengeId}/answer`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: DEMO_ANSWERS[challengeId].canonical })
  })

  // Step 2
  let scanRes2;
  for (const t of tokens) {
    if (t === currentToken) continue;
    scanRes2 = await worker.fetch(`/api/scan/${t}`, { method: 'POST', headers: { cookie } });
    b = await scanRes2.json();
    if (b.state === 'CHALLENGE') {
      break;
    }
  }
  if (b.state !== 'CHALLENGE') throw new Error('Step 2 failed to unlock: ' + JSON.stringify(b));
  challengeId = b.challengeId;
  for (let i = 0; i < wrongCountB; i++) {
    await worker.fetch(`/api/challenge/${challengeId}/answer`, {
      method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: DEMO_ANSWERS[challengeId].wrong })
    })
  }

  await worker.fetch(`/api/challenge/${challengeId}/answer`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: DEMO_ANSWERS[challengeId].canonical })
  })
}

beforeAll(async () => {
  applyMigrationsAndSeed()
  worker = await unstable_dev(join(API_ROOT, 'src', 'index.ts'), {
    experimental: { disableExperimentalWarning: true },
    local: true,
    persistTo: TEST_PERSIST,
    vars: { ORGANIZER_SECRET: 'secret' }
  })

  const loginRes = await worker.fetch('/api/organizer/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase: 'secret' })
  })
  cookieAuth = loginRes.headers.get('set-cookie')?.split(';')[0]!
}, 30000)

afterAll(async () => {
  if (worker) await worker.stop()
})

describe('Scoring & Ranking Rules', () => {
  it('A/B/C player scenario', async () => {
    // Player A: complete all questions first attempt
    await play('Player A', 0, 0)
    // Player B: make one wrong attempt, then complete
    await play('Player B', 1, 0)
    // Player C: same answer record as A but takes longer (we add a tiny delay)
    await play('Player C', 0, 0, 1000) // 1s delay

    // Player D: incomplete session
    await worker.fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'Player D', identifierType: 'LEGAJO', identifierValue: 'Player D ' + Math.floor(Math.random() * 10000), startToken: TOKEN_START })
    })

    // Play one that goes negative to verify floor
    await play('Player Negative', 25, 0)

    const res = await worker.fetch('/api/organizer/results', {
      headers: { cookie: cookieAuth }
    })
    const data = await res.json() as any
    
    const ranking = data.ranking
    expect(ranking.length).toBe(4) // A, B, C, Negative (D is active)

    const playerA = ranking.find((p: any) => p.playerName === 'Player A')
    const playerB = ranking.find((p: any) => p.playerName === 'Player B')
    const playerC = ranking.find((p: any) => p.playerName === 'Player C')
    const playerNeg = ranking.find((p: any) => p.playerName === 'Player Negative')

    expect(playerA.score).toBe(200) // 2 correct
    expect(playerB.score).toBe(190) // 2 correct, 1 wrong
    expect(playerC.score).toBe(200) // 2 correct, slower
    expect(playerNeg.score).toBe(0) // 2 correct, 25 wrong -> negative bounded to 0

    // Rank validation
    expect(playerA.rank).toBe(1)
    expect(playerC.rank).toBe(1) // Tied with A
    
    // B has 190, so they should be rank 3 (since 1 and 2 are tied for 1st? Wait, rank algorithm is 1, 1, 3)
    expect(playerB.rank).toBe(3)
    expect(playerNeg.rank).toBe(4)

    // Player D is not ranked
    expect(data.active.find((p: any) => p.playerName === 'Player D')).toBeDefined()
  })
})
