/**
 * Typed D1 query helpers — busqueda-tesoro-tutorias.
 * Keeps route handlers readable and type-safe.
 *
 * Security:
 *   accepted_answers is NEVER selected in queries that return data to clients.
 *   It is only fetched server-side for validation.
 *
 * State model:
 *   sessions.unlocked_step = NULL  → player is travelling to next checkpoint
 *   sessions.unlocked_step = N     → player has scanned step N; challenge active
 *   An answer is valid ONLY when unlocked_step === current_step.
 */

// ── Row types ─────────────────────────────────────────────────────────────

export interface CheckpointRow {
  id: number
  token: string
  sequence_order: number
  label: string | null
  is_start: number // 0 | 1
}

export interface SessionRow {
  id: number
  session_token: string
  player_name: string
  route_id: number
  current_step: number
  status: string          // 'active' | 'completed' | 'abandoned'
  unlocked_step: number | null // NULL = travelling; N = challenge at step N unlocked
  started_at: string
  completed_at: string | null
}

export interface RouteStepRow {
  id: number
  route_id: number
  position: number
  checkpoint_id: number
  clue_text: string
}

export interface ChallengeRow {
  id: number
  checkpoint_id: number
  question_text: string
  accepted_answers: string // JSON array — NEVER send to client
  hint_text: string | null
}

// ── Queries ───────────────────────────────────────────────────────────────

/** Find a checkpoint by its opaque QR token. */
export async function getCheckpointByToken(
  db: D1Database,
  token: string
): Promise<CheckpointRow | null> {
  const result = await db
    .prepare('SELECT id, token, sequence_order, label, is_start FROM checkpoints WHERE token = ?')
    .bind(token)
    .first<CheckpointRow>()
  return result ?? null
}

/** Find any session (any status) by its opaque session token (from cookie). */
export async function getAnySession(
  db: D1Database,
  sessionToken: string
): Promise<SessionRow | null> {
  const result = await db
    .prepare(
      `SELECT id, session_token, player_name, route_id, current_step, status,
              unlocked_step, started_at, completed_at
       FROM sessions WHERE session_token = ?`
    )
    .bind(sessionToken)
    .first<SessionRow>()
  return result ?? null
}

/** Find an active (non-completed) session by token. */
export async function getActiveSession(
  db: D1Database,
  sessionToken: string
): Promise<SessionRow | null> {
  const result = await db
    .prepare(
      `SELECT id, session_token, player_name, route_id, current_step, status,
              unlocked_step, started_at, completed_at
       FROM sessions WHERE session_token = ? AND status = 'active'`
    )
    .bind(sessionToken)
    .first<SessionRow>()
  return result ?? null
}

/** Get a route step by route + position. */
export async function getRouteStep(
  db: D1Database,
  routeId: number,
  position: number
): Promise<RouteStepRow | null> {
  const result = await db
    .prepare(
      'SELECT id, route_id, position, checkpoint_id, clue_text FROM route_steps WHERE route_id = ? AND position = ?'
    )
    .bind(routeId, position)
    .first<RouteStepRow>()
  return result ?? null
}

/** Get the total number of steps in a route. */
export async function getRouteTotalSteps(
  db: D1Database,
  routeId: number
): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as cnt FROM route_steps WHERE route_id = ?')
    .bind(routeId)
    .first<{ cnt: number }>()
  return result?.cnt ?? 0
}

/**
 * Get a challenge by checkpoint id.
 * accepted_answers included here — used server-side ONLY for validation.
 */
export async function getChallengeByCheckpoint(
  db: D1Database,
  checkpointId: number
): Promise<ChallengeRow | null> {
  const result = await db
    .prepare(
      'SELECT id, checkpoint_id, question_text, accepted_answers, hint_text FROM challenges WHERE checkpoint_id = ?'
    )
    .bind(checkpointId)
    .first<ChallengeRow>()
  return result ?? null
}

/** Get a challenge by id. accepted_answers included — server-side only. */
export async function getChallengeById(
  db: D1Database,
  challengeId: number
): Promise<ChallengeRow | null> {
  const result = await db
    .prepare(
      'SELECT id, checkpoint_id, question_text, accepted_answers, hint_text FROM challenges WHERE id = ?'
    )
    .bind(challengeId)
    .first<ChallengeRow>()
  return result ?? null
}

/** Get the first available route. */
export async function getDefaultRoute(
  db: D1Database
): Promise<{ id: number; name: string } | null> {
  const result = await db
    .prepare('SELECT id, name FROM routes LIMIT 1')
    .first<{ id: number; name: string }>()
  return result ?? null
}

/** Create a new game session. Returns the new row id. */
export async function createSession(
  db: D1Database,
  opts: {
    sessionToken: string
    playerName: string
    routeId: number
  }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO sessions (session_token, player_name, route_id, current_step, status, unlocked_step)
       VALUES (?, ?, ?, 1, 'active', NULL)`
    )
    .bind(opts.sessionToken, opts.playerName, opts.routeId)
    .run()
  return result.meta.last_row_id as number
}

/**
 * Unlock the challenge for the current step.
 * Sets unlocked_step = step (which equals current_step at call time).
 */
export async function unlockStep(
  db: D1Database,
  sessionId: number,
  step: number
): Promise<void> {
  await db
    .prepare('UPDATE sessions SET unlocked_step = ? WHERE id = ?')
    .bind(step, sessionId)
    .run()
}

/**
 * Advance to next step and clear the unlock.
 * Sets current_step = nextStep, unlocked_step = NULL.
 */
export async function advanceStep(
  db: D1Database,
  sessionId: number,
  nextStep: number
): Promise<void> {
  await db
    .prepare('UPDATE sessions SET current_step = ?, unlocked_step = NULL WHERE id = ?')
    .bind(nextStep, sessionId)
    .run()
}

/** Mark session as completed. Sets status, completed_at, unlocked_step = NULL. */
export async function completeSession(
  db: D1Database,
  sessionId: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE sessions
       SET status = 'completed', completed_at = datetime('now'), unlocked_step = NULL
       WHERE id = ?`
    )
    .bind(sessionId)
    .run()
}

/** Log a scan event (audit only — not the source of truth for game state). */
export async function logScanEvent(
  db: D1Database,
  opts: {
    sessionId: number | null
    checkpointId: number | null
    rawToken: string
    outcome: string
  }
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO scan_events (session_id, checkpoint_id, raw_token, outcome) VALUES (?, ?, ?, ?)'
    )
    .bind(opts.sessionId, opts.checkpointId, opts.rawToken, opts.outcome)
    .run()
}

/** Log an answer attempt (audit log). */
export async function logAnswerAttempt(
  db: D1Database,
  opts: {
    sessionId: number
    challengeId: number
    rawAnswer: string
    correct: boolean
  }
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO answer_attempts (session_id, challenge_id, raw_answer, correct) VALUES (?, ?, ?, ?)'
    )
    .bind(opts.sessionId, opts.challengeId, opts.rawAnswer, opts.correct ? 1 : 0)
    .run()
}
