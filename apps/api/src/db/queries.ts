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
  primary_clue: string
  secondary_clue: string | null
  instruction: string | null
}

export interface ChallengeRow {
  id: number
  checkpoint_id: number
  question_text: string
  accepted_answers: string // JSON array — NEVER send to client
  hint_text: string | null
  active: number
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

/** Get a route step by session + position. */
export async function getSessionStep(
  db: D1Database,
  sessionId: number,
  position: number
): Promise<RouteStepRow | null> {
  const result = await db
    .prepare(
      'SELECT id, session_id as route_id, position, checkpoint_id, (SELECT primary_clue FROM checkpoints WHERE id = session_steps.checkpoint_id) as primary_clue, (SELECT secondary_clue FROM checkpoints WHERE id = session_steps.checkpoint_id) as secondary_clue, (SELECT instruction FROM checkpoints WHERE id = session_steps.checkpoint_id) as instruction FROM session_steps WHERE session_id = ? AND position = ?'
    )
    .bind(sessionId, position)
    .first<RouteStepRow>()
  return result ?? null
}

/** Get the total number of steps in a session. */
export async function getSessionTotalSteps(
  db: D1Database,
  sessionId: number
): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as cnt FROM session_steps WHERE session_id = ?')
    .bind(sessionId)
    .first<{ cnt: number }>()
  return result?.cnt ?? 0
}

/**
 * Get the challenge assigned to a session for a specific route step.
 * accepted_answers included — used server-side ONLY for validation.
 */
export async function getAssignedChallenge(
  db: D1Database,
  sessionId: number,
  routeStep: number
): Promise<ChallengeRow | null> {
  const result = await db
    .prepare(
      `SELECT c.id, c.checkpoint_id, c.question_text, c.accepted_answers, c.hint_text, c.active
       FROM challenges c
       JOIN session_challenge_assignments a ON a.challenge_id = c.id
       WHERE a.session_id = ? AND a.route_step = ?`
    )
    .bind(sessionId, routeStep)
    .first<ChallengeRow>()
  return result ?? null
}

/**
 * Get a random active challenge for a checkpoint.
 */
export async function getRandomActiveChallengeForCheckpoint(
  db: D1Database,
  checkpointId: number
): Promise<ChallengeRow | null> {
  const result = await db
    .prepare(
      `SELECT id, checkpoint_id, question_text, accepted_answers, hint_text, active
       FROM challenges
       WHERE checkpoint_id = ? AND active = 1
       ORDER BY RANDOM()
       LIMIT 1`
    )
    .bind(checkpointId)
    .first<ChallengeRow>()
  return result ?? null
}

/**
 * Assign a challenge to a session for a specific route step.
 */
export async function assignChallenge(
  db: D1Database,
  sessionId: number,
  routeStep: number,
  challengeId: number
): Promise<void> {
  await db
    .prepare(
      'INSERT OR IGNORE INTO session_challenge_assignments (session_id, route_step, challenge_id) VALUES (?, ?, ?)'
    )
    .bind(sessionId, routeStep, challengeId)
    .run()
}

/** Get a challenge by id. accepted_answers included — server-side only. */
export async function getChallengeById(
  db: D1Database,
  challengeId: number
): Promise<ChallengeRow | null> {
  const result = await db
    .prepare(
      'SELECT id, checkpoint_id, question_text, accepted_answers, hint_text, active FROM challenges WHERE id = ?'
    )
    .bind(challengeId)
    .first<ChallengeRow>()
  return result ?? null
}

/** Get a random active route. */
export async function getRandomActiveRoute(
  db: D1Database
): Promise<{ id: number; name: string } | null> {
  const result = await db
    .prepare('SELECT id, name FROM routes WHERE active = 1 ORDER BY RANDOM() LIMIT 1')
    .first<{ id: number; name: string }>()
  return result ?? null
}

export async function getEventSettings(db: D1Database) {
  const result = await db.prepare("SELECT * FROM event_settings WHERE id = 1").first()
  return result as any
}

export interface LivePreflightIssue {
  code: 'MISSING_EVENT_CONFIGURATION' | 'MISSING_START_CHECKPOINT' | 'MISSING_PRIMARY_CLUE' | 'MISSING_ACTIVE_QUESTION' | 'ACTIVE_NEEDS_REVIEW_QUESTION'
  checkpointId?: number
  challengeId?: number
  label?: string
  message: string
}

/** Content checks required before changing an event from DRAFT/PAUSED to LIVE. */
export async function getLivePreflightIssues(db: D1Database): Promise<LivePreflightIssue[]> {
  const issues: LivePreflightIssue[] = []
  const settings = await getEventSettings(db) as {
    event_name?: string
    points_per_correct?: number
    wrong_answer_penalty?: number
    hint_penalty?: number
  } | null
  if (!settings?.event_name?.trim() || settings.points_per_correct == null || settings.wrong_answer_penalty == null || settings.hint_penalty == null) {
    issues.push({ code: 'MISSING_EVENT_CONFIGURATION', message: 'Falta la configuración básica del evento.' })
  }

  const start = await db.prepare('SELECT id FROM checkpoints WHERE is_start = 1 AND active = 1 LIMIT 1').first()
  if (!start) issues.push({ code: 'MISSING_START_CHECKPOINT', message: 'Falta un checkpoint de INICIO activo.' })

  const checkpoints = await db.prepare('SELECT id, label, is_start, primary_clue FROM checkpoints WHERE active = 1 ORDER BY id').all<{ id: number; label: string | null; is_start: number; primary_clue: string | null }>()
  for (const checkpoint of checkpoints.results ?? []) {
    const label = checkpoint.label ?? `Checkpoint ${checkpoint.id}`
    if (!checkpoint.is_start && !checkpoint.primary_clue?.trim()) {
      issues.push({ code: 'MISSING_PRIMARY_CLUE', checkpointId: checkpoint.id, label, message: `${label}: falta acertijo de navegación.` })
    }
    const activeChallenge = await db.prepare('SELECT id FROM challenges WHERE checkpoint_id = ? AND active = 1 AND needs_review = 0 LIMIT 1').bind(checkpoint.id).first()
    if (!activeChallenge) {
      issues.push({ code: 'MISSING_ACTIVE_QUESTION', checkpointId: checkpoint.id, label, message: `${label}: no tiene preguntas activas listas para jugar.` })
    }
  }

  const reviewQuestions = await db.prepare(`
    SELECT ch.id, ch.question_text, cp.label
    FROM challenges ch JOIN checkpoints cp ON cp.id = ch.checkpoint_id
    WHERE ch.active = 1 AND ch.needs_review = 1
    ORDER BY ch.id
  `).all<{ id: number; question_text: string; label: string | null }>()
  for (const challenge of reviewQuestions.results ?? []) {
    issues.push({
      code: 'ACTIVE_NEEDS_REVIEW_QUESTION',
      challengeId: challenge.id,
      message: `${challenge.label ?? 'Checkpoint'}: una pregunta activa sigue marcada REVISAR.`,
    })
  }
  return issues
}

/** Create a new game session. Returns the new row id. */
export async function createSession(
  db: D1Database,
  opts: {
    sessionToken: string
    playerName: string
    participantId: number
  }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO sessions (session_token, player_name, route_id, current_step, status, unlocked_step, participant_id)
       VALUES (?, ?, 1, 1, 'active', NULL, ?)`
    )
    .bind(opts.sessionToken, opts.playerName, opts.participantId)
    .run();
  
  const sessionId = result.meta.last_row_id as number;
  
  // Create randomized session_steps
  // 1. Get all active checkpoints (except start)
  const checkpoints = await db.prepare('SELECT id FROM checkpoints WHERE active = 1 AND is_start = 0').all();
  const cids = (checkpoints.results || []).map((r: any) => r.id);
  
  // 2. Shuffle
  for (let i = cids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cids[i], cids[j]] = [cids[j], cids[i]];
  }
  
  // 3. Insert session_steps
  for (let i = 0; i < cids.length; i++) {
    await db.prepare('INSERT INTO session_steps (session_id, position, checkpoint_id) VALUES (?, ?, ?)')
      .bind(sessionId, i + 1, cids[i])
      .run();
  }

  return sessionId;
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
): Promise<number> {
  const result = await db
    .prepare(
      'INSERT INTO answer_attempts (session_id, challenge_id, raw_answer, correct) VALUES (?, ?, ?, ?)'
    )
    .bind(opts.sessionId, opts.challengeId, opts.rawAnswer, opts.correct ? 1 : 0)
    .run()
  return result.meta.last_row_id as number
}

export async function getOrganizerResults(db: D1Database) {
  const result = await db.prepare(`
    SELECT 
      s.id, 
      p.id as participantId,
      p.display_name as playerName,
      p.identifier_type as identifierType,
      p.identifier_suffix as identifierSuffix,
      p.invalidated_at as invalidatedAt,
      s.status, 
      s.current_step as currentStep,
      s.started_at as startedAt, 
      s.completed_at as completedAt,
      (SELECT COUNT(*) FROM session_steps WHERE session_id = s.id) as totalSteps,
      IFNULL(SUM(CASE WHEN a.correct = 1 THEN 1 ELSE 0 END), 0) as correctCount,
      IFNULL(SUM(CASE WHEN a.correct = 0 THEN 1 ELSE 0 END), 0) as wrongCount,
      (SELECT COUNT(*) FROM question_hint_usage h WHERE h.session_id = s.id) as hintsUsed
    FROM sessions s
    JOIN participants p ON s.participant_id = p.id
    LEFT JOIN answer_attempts a ON s.id = a.session_id
    GROUP BY s.id
  `).all()
  return result.results
}

/** Create or get a participant. */
export async function findParticipant(
  db: D1Database,
  identifierType: string,
  identifierHash: string
): Promise<any | null> {
  const res = await db.prepare('SELECT * FROM participants WHERE identifier_type = ? AND identifier_hash = ?').bind(identifierType, identifierHash).first();
  return res ?? null;
}

export async function createParticipant(
  db: D1Database,
  opts: {
    displayName: string
    lastName?: string
    career?: string
    identifierType: string
    identifierHash: string
    identifierSuffix: string
  }
): Promise<number> {
  const result = await db.prepare(
    'INSERT INTO participants (display_name, last_name, career, identifier_type, identifier_hash, identifier_suffix) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(opts.displayName, opts.lastName ?? null, opts.career ?? null, opts.identifierType, opts.identifierHash, opts.identifierSuffix).run();
  return result.meta.last_row_id as number;
}


export async function hasUsedHint(db: D1Database, sessionId: number, position: number): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM hint_usage WHERE session_id = ? AND step_position = ?').bind(sessionId, position).first();
  return !!row;
}

export async function logHintUsage(db: D1Database, sessionId: number, position: number): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO hint_usage (session_id, step_position) VALUES (?, ?)').bind(sessionId, position).run();
}

export async function hasUsedQuestionHint(db: D1Database, sessionId: number, challengeId: number): Promise<boolean> {
  return !!await db.prepare('SELECT 1 FROM question_hint_usage WHERE session_id = ? AND challenge_id = ?').bind(sessionId, challengeId).first()
}

export async function logQuestionHintUsage(db: D1Database, sessionId: number, challengeId: number): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO question_hint_usage (session_id, challenge_id) VALUES (?, ?)').bind(sessionId, challengeId).run()
}

export async function getSessionScore(db: D1Database, sessionId: number): Promise<number> {
  const counts = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM answer_attempts WHERE session_id = ? AND correct = 1) AS correct_count,
    (SELECT COUNT(*) FROM answer_attempts WHERE session_id = ? AND correct = 0) AS wrong_count,
    (SELECT COUNT(*) FROM question_hint_usage WHERE session_id = ?) AS hint_count,
    (SELECT COUNT(*) FROM answer_review_requests WHERE session_id = ? AND status = 'APPROVED' AND awarded_correct = 1) AS manual_correct_count,
    (SELECT COUNT(*) FROM answer_review_requests WHERE session_id = ? AND status = 'APPROVED' AND reversed_wrong = 1) AS reversed_wrong_count
  `).bind(sessionId, sessionId, sessionId, sessionId, sessionId).first<{ correct_count: number; wrong_count: number; hint_count: number; manual_correct_count: number; reversed_wrong_count: number }>()
  const settings = await getEventSettings(db) as { points_per_correct?: number; wrong_answer_penalty?: number; hint_penalty?: number } | null
  return Math.max(0, ((counts?.correct_count ?? 0) + (counts?.manual_correct_count ?? 0)) * (settings?.points_per_correct ?? 100) - Math.max(0, (counts?.wrong_count ?? 0) - (counts?.reversed_wrong_count ?? 0)) * (settings?.wrong_answer_penalty ?? 10) - (counts?.hint_count ?? 0) * (settings?.hint_penalty ?? 5))
}

export async function getCheckpointByFallbackCode(db: D1Database, code: string): Promise<CheckpointRow | null> {
  return await db.prepare('SELECT id, token, sequence_order, label, is_start FROM checkpoints WHERE fallback_code = ?').bind(code.trim().toUpperCase()).first<CheckpointRow>() ?? null
}
