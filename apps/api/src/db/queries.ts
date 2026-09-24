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

import { normalizeAnswer } from '@busqueda-tesoro/shared'

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
  event_run_id: number
  session_token: string
  player_name: string
  current_step: number
  status: string          // 'active' | 'completed' | 'abandoned'
  unlocked_step: number | null // NULL = travelling; N = challenge at step N unlocked
  started_at: string
  completed_at: string | null
}

export interface SessionStepRow {
  id: number
  session_id: number
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
      `SELECT id, event_run_id, session_token, player_name, current_step, status,
              unlocked_step, started_at, completed_at
       FROM sessions WHERE session_token = ?
         AND event_run_id = (SELECT current_event_run_id FROM event_settings WHERE id = 1)`
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
      `SELECT id, event_run_id, session_token, player_name, current_step, status,
              unlocked_step, started_at, completed_at
       FROM sessions WHERE session_token = ? AND status = 'active'
         AND event_run_id = (SELECT current_event_run_id FROM event_settings WHERE id = 1)`
    )
    .bind(sessionToken)
    .first<SessionRow>()
  return result ?? null
}

/** Get a persisted session step by session + position. */
export async function getSessionStep(
  db: D1Database,
  sessionId: number,
  position: number
): Promise<SessionStepRow | null> {
  const result = await db
    .prepare(
      'SELECT id, session_id, position, checkpoint_id, (SELECT primary_clue FROM checkpoints WHERE id = session_steps.checkpoint_id) as primary_clue, (SELECT secondary_clue FROM checkpoints WHERE id = session_steps.checkpoint_id) as secondary_clue, (SELECT instruction FROM checkpoints WHERE id = session_steps.checkpoint_id) as instruction FROM session_steps WHERE session_id = ? AND position = ?'
    )
    .bind(sessionId, position)
    .first<SessionStepRow>()
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
    eventRunId: number
  }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO sessions (session_token, player_name, current_step, status, unlocked_step, participant_id, event_run_id)
       VALUES (?, ?, 0, 'active', 0, ?, ?)`
    )
    .bind(opts.sessionToken, opts.playerName, opts.participantId, opts.eventRunId)
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
 * Remove only records created by an unsuccessful session initialization.
 * Existing participants are deliberately never removed by this helper.
 */
export async function cleanupFailedSessionStart(
  db: D1Database,
  sessionId: number | null,
  newlyCreatedParticipantId: number | null
): Promise<void> {
  if (sessionId) {
    // Some historical audit tables pre-date ON DELETE CASCADE. Delete only
    // child records for this not-yet-started session before deleting it.
    await db.batch([
      db.prepare('DELETE FROM answer_review_requests WHERE session_id = ?').bind(sessionId),
      db.prepare('DELETE FROM support_requests WHERE session_id = ?').bind(sessionId),
      db.prepare('DELETE FROM question_hint_usage WHERE session_id = ?').bind(sessionId),
      db.prepare('DELETE FROM hint_usage WHERE session_id = ?').bind(sessionId),
      db.prepare('DELETE FROM answer_attempts WHERE session_id = ?').bind(sessionId),
      db.prepare('DELETE FROM attempts WHERE session_id = ?').bind(sessionId),
      db.prepare('DELETE FROM scan_events WHERE session_id = ?').bind(sessionId),
      db.prepare('DELETE FROM session_challenge_assignments WHERE session_id = ?').bind(sessionId),
      db.prepare('DELETE FROM session_steps WHERE session_id = ?').bind(sessionId),
      db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId),
    ])
  }

  if (newlyCreatedParticipantId) {
    await db.prepare(`
      DELETE FROM participants
      WHERE id = ?
        AND NOT EXISTS (SELECT 1 FROM sessions WHERE participant_id = participants.id)
    `).bind(newlyCreatedParticipantId).run()
  }
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
      p.career as career,
      s.invalidated_at as invalidatedAt,
      s.invalidation_reason as invalidationReason,
      s.audit_reviewed_at as auditReviewedAt,
      er.points_per_correct as pointsPerCorrect,
      er.wrong_answer_penalty as wrongAnswerPenalty,
      er.hint_penalty as hintPenalty,
      s.status, 
      s.current_step as currentStep,
      s.unlocked_step as unlockedStep,
      s.started_at as startedAt, 
      s.completed_at as completedAt,
      (SELECT COUNT(*) FROM session_steps WHERE session_id = s.id) as totalSteps,
      IFNULL(SUM(CASE WHEN a.correct = 1 THEN 1 ELSE 0 END), 0) as correctCount,
      IFNULL(SUM(CASE WHEN a.correct = 0 THEN 1 ELSE 0 END), 0) as wrongCount,
      (SELECT COALESCE(SUM(awarded_correct),0) FROM answer_review_requests r WHERE r.session_id=s.id AND r.status='APPROVED') as manualCorrectCount,
      (SELECT COALESCE(SUM(reversed_wrong),0) FROM answer_review_requests r WHERE r.session_id=s.id AND r.status='APPROVED') as reversedWrongCount,
      (SELECT COALESCE(SUM(amount),0) FROM score_adjustments sa WHERE sa.session_id=s.id) as manualAdjustmentTotal,
      (SELECT COUNT(*) FROM score_adjustments sa WHERE sa.session_id=s.id) as manualAdjustmentCount,
      (SELECT COUNT(*) FROM question_hint_usage h WHERE h.session_id = s.id) as hintsUsed,
      EXISTS(SELECT 1 FROM answer_review_requests r WHERE r.session_id = s.id AND r.status = 'PENDING') as pendingReview
    FROM sessions s
    JOIN participants p ON s.participant_id = p.id
    JOIN event_runs er ON er.id = s.event_run_id
    LEFT JOIN answer_attempts a ON s.id = a.session_id
    WHERE s.event_run_id = (SELECT current_event_run_id FROM event_settings WHERE id = 1)
    GROUP BY s.id
  `).all()
  return result.results
}

export type OrganizerSessionSnapshot = {
  id: number
  eventRunId?: number
  playerName: string
  career: string | null
  identifierType: string
  identifierSuffix: string
  status: string
  currentStep: number
  unlockedStep: number | null
  startedAt: string
  completedAt: string | null
  totalSteps: number
  invalidatedAt?: string | null
  invalidationReason?: string | null
  auditReviewedAt?: string | null
  auditReviewedBy?: string | null
}

/**
 * Derive the most recent authoritative transition using existing audit rows.
 * It never writes and deliberately ignores rescans, which do not change state.
 */
export async function getOrganizerStateSince(db: D1Database, session: OrganizerSessionSnapshot): Promise<{ value: string; source: string }> {
  if (session.status === 'completed' && session.completedAt) return { value: session.completedAt, source: 'SESSION_COMPLETED_AT' }

  if (session.unlockedStep === session.currentStep) {
    if (session.currentStep === 0) return { value: session.startedAt, source: 'SESSION_STARTED_AT' }
    const scan = await db.prepare(`
      SELECT MAX(se.scanned_at) AS changedAt
      FROM scan_events se
      JOIN session_steps ss ON ss.session_id = se.session_id AND ss.position = ? AND ss.checkpoint_id = se.checkpoint_id
      WHERE se.session_id = ? AND se.outcome IN ('CHALLENGE', 'FALLBACK_CODE_CHALLENGE')
    `).bind(session.currentStep, session.id).first<{ changedAt: string | null }>()
    if (scan?.changedAt) return { value: scan.changedAt, source: 'CHECKPOINT_UNLOCK_SCAN' }
    const assignment = await db.prepare('SELECT assigned_at AS changedAt FROM session_challenge_assignments WHERE session_id = ? AND route_step = ?')
      .bind(session.id, session.currentStep).first<{ changedAt: string | null }>()
    return { value: assignment?.changedAt ?? session.startedAt, source: assignment?.changedAt ? 'QUESTION_ASSIGNMENT_FALLBACK' : 'SESSION_START_FALLBACK' }
  }

  const transition = await db.prepare(`
    SELECT MAX(changedAt) AS changedAt FROM (
      SELECT a.attempted_at AS changedAt
      FROM answer_attempts a
      JOIN session_challenge_assignments sca ON sca.session_id = a.session_id AND sca.challenge_id = a.challenge_id
      WHERE a.session_id = ? AND sca.route_step = ? AND a.correct = 1
      UNION ALL
      SELECT r.resolved_at AS changedAt
      FROM answer_review_requests r
      JOIN session_challenge_assignments sca ON sca.session_id = r.session_id AND sca.challenge_id = r.challenge_id
      WHERE r.session_id = ? AND sca.route_step = ? AND r.status = 'APPROVED' AND r.awarded_correct = 1
    )
  `).bind(session.id, session.currentStep - 1, session.id, session.currentStep - 1).first<{ changedAt: string | null }>()
  return { value: transition?.changedAt ?? session.startedAt, source: transition?.changedAt ? 'SUCCESSFUL_ADVANCE' : 'SESSION_START_FALLBACK' }
}

export async function getOrganizerPlayerDetail(db: D1Database, sessionId: number) {
  const session = await db.prepare(`
    SELECT s.id, s.event_run_id AS eventRunId, s.player_name AS playerName, p.career, p.identifier_type AS identifierType,
      p.identifier_suffix AS identifierSuffix, s.status, s.current_step AS currentStep,
      s.unlocked_step AS unlockedStep, s.started_at AS startedAt, s.completed_at AS completedAt,
      s.invalidated_at AS invalidatedAt, s.invalidation_reason AS invalidationReason,
      s.audit_reviewed_at AS auditReviewedAt, s.audit_reviewed_by AS auditReviewedBy,
      (SELECT COUNT(*) FROM session_steps WHERE session_id = s.id) AS totalSteps
    FROM sessions s JOIN participants p ON p.id = s.participant_id WHERE s.id = ?
  `).bind(sessionId).first<OrganizerSessionSnapshot>()
  if (!session) return null

  const [settings, scoreBreakdown, pendingReview, current, destination, assignments, attempts, navigationHints, scoreAdjustments] = await Promise.all([
    db.prepare(`SELECT er.points_per_correct, er.wrong_answer_penalty, er.hint_penalty
      FROM sessions s JOIN event_runs er ON er.id = s.event_run_id WHERE s.id = ?`).bind(sessionId).first<any>(),
    getSessionScoreBreakdown(db, sessionId),
    db.prepare("SELECT COUNT(*) AS count FROM answer_review_requests WHERE session_id = ? AND status = 'PENDING'").bind(sessionId).first<{ count: number }>(),
    db.prepare(`SELECT cp.label AS checkpoint, ch.question_text AS question, sca.assigned_at AS assignedAt,
      qhu.used_at AS hintUsedAt
      FROM session_challenge_assignments sca
      JOIN challenges ch ON ch.id = sca.challenge_id JOIN checkpoints cp ON cp.id = ch.checkpoint_id
      LEFT JOIN question_hint_usage qhu ON qhu.session_id = sca.session_id AND qhu.challenge_id = sca.challenge_id
      WHERE sca.session_id = ? AND sca.route_step = ?`).bind(sessionId, session.currentStep).first<any>(),
    db.prepare(`SELECT cp.label AS checkpoint, cp.primary_clue AS clue
      FROM session_steps ss JOIN checkpoints cp ON cp.id = ss.checkpoint_id
      WHERE ss.session_id = ? AND ss.position = ?`).bind(sessionId, session.currentStep).first<any>(),
    db.prepare(`SELECT sca.route_step AS stepPosition, cp.label AS checkpoint, ch.question_text AS question,
      sca.assigned_at AS assignedAt, qhu.used_at AS hintUsedAt
      FROM session_challenge_assignments sca
      JOIN challenges ch ON ch.id = sca.challenge_id JOIN checkpoints cp ON cp.id = ch.checkpoint_id
      LEFT JOIN question_hint_usage qhu ON qhu.session_id = sca.session_id AND qhu.challenge_id = sca.challenge_id
      WHERE sca.session_id = ? ORDER BY sca.route_step`).bind(sessionId).all<any>(),
    db.prepare(`SELECT a.id, a.challenge_id AS challengeId, sca.route_step AS stepPosition, a.raw_answer AS answer, a.correct,
      a.attempted_at AS attemptedAt, r.status AS reviewStatus, r.created_at AS reviewRequestedAt,
      r.resolved_at AS reviewResolvedAt, r.awarded_correct AS awardedCorrect,
      r.reversed_wrong AS reversedWrong
      FROM answer_attempts a
      LEFT JOIN session_challenge_assignments sca ON sca.session_id = a.session_id AND sca.challenge_id = a.challenge_id
      LEFT JOIN answer_review_requests r ON r.answer_attempt_id = a.id
      WHERE a.session_id = ? ORDER BY a.attempted_at, a.id`).bind(sessionId).all<any>(),
    db.prepare('SELECT step_position AS stepPosition, used_at AS usedAt FROM hint_usage WHERE session_id = ? ORDER BY step_position').bind(sessionId).all<any>(),
    db.prepare(`SELECT id, amount, reason, related_attempt_id AS relatedAttemptId,
      compensates_adjustment_id AS compensatesAdjustmentId, created_by AS createdBy,
      created_at AS createdAt FROM score_adjustments WHERE session_id = ? ORDER BY created_at, id`)
      .bind(sessionId).all<any>(),
  ])
  const stateSince = await getOrganizerStateSince(db, session)
  const attemptsByStep = new Map<number, any[]>()
  for (const attempt of attempts.results ?? []) {
    const step = Number(attempt.stepPosition)
    const list = attemptsByStep.get(step) ?? []
    const baseEffect = Number(attempt.correct) === 1 ? Number(settings?.points_per_correct ?? 100) : -Number(settings?.wrong_answer_penalty ?? 10)
    const reviewCorrection = attempt.reviewStatus === 'APPROVED'
      ? Number(attempt.awardedCorrect ?? 0) * Number(settings?.points_per_correct ?? 100) + Number(attempt.reversedWrong ?? 0) * Number(settings?.wrong_answer_penalty ?? 10)
      : 0
    list.push({ ...attempt, correct: Number(attempt.correct) === 1, scoreEffect: baseEffect, reviewCorrection })
    attemptsByStep.set(step, list)
  }

  const routeHintByStep = new Map((navigationHints.results ?? []).map((hint: any) => [Number(hint.stepPosition), hint.usedAt]))
  const history = (assignments.results ?? []).map((assignment: any) => ({
    ...assignment,
    stepPosition: Number(assignment.stepPosition),
    routeHintUsedAt: routeHintByStep.get(Number(assignment.stepPosition)) ?? null,
    attempts: attemptsByStep.get(Number(assignment.stepPosition)) ?? [],
  }))

  const flatAttempts = history.flatMap((item: any) => item.attempts)
  const auditSuggestions: Array<{ code: string; label: string; attemptIds?: number[] }> = []
  for (const attempt of flatAttempts.filter((item: any) => !item.correct)) {
    const laterMatchingCorrect = flatAttempts.find((candidate: any) => candidate.correct
      && Number(candidate.id) > Number(attempt.id)
      && Number(candidate.challengeId) === Number(attempt.challengeId)
      && normalizeAnswer(candidate.answer) === normalizeAnswer(attempt.answer))
    if (laterMatchingCorrect) auditSuggestions.push({
      code: 'REJECTED_THEN_ACCEPTED_EQUIVALENT',
      label: 'Una respuesta equivalente fue rechazada y luego aceptada. Revisá la penalidad original.',
      attemptIds: [Number(attempt.id), Number(laterMatchingCorrect.id)],
    })
    if (attempt.reviewStatus === 'APPROVED') auditSuggestions.push({
      code: 'APPROVED_REVIEW', label: 'Una respuesta incorrecta tuvo revisión aprobada.', attemptIds: [Number(attempt.id)],
    })
    if (attempt.reviewStatus === 'PENDING') auditSuggestions.push({
      code: 'PENDING_REVIEW', label: 'Hay una revisión de respuesta todavía pendiente.', attemptIds: [Number(attempt.id)],
    })
  }
  if ((scoreBreakdown.hintCount ?? 0) > 0) auditSuggestions.push({
    code: 'HINTS_USED', label: `Se cobraron ${scoreBreakdown.hintCount} pista(s) de pregunta; verificar solo si hubo un incidente reportado.`,
  })

  return {
    ...session,
    score: scoreBreakdown.finalScore,
    scoreBreakdown,
    scoreAdjustments: scoreAdjustments.results ?? [],
    auditSuggestions,
    auditStatus: session.auditReviewedAt ? 'REVIEWED' : 'PENDING',
    errors: flatAttempts.filter((attempt: any) => !attempt.correct).length,
    questionHints: history.filter((item: any) => item.hintUsedAt).length,
    navigationHints: navigationHints.results?.length ?? 0,
    pendingReview: Number(pendingReview?.count ?? 0) > 0,
    stateSince: stateSince.value,
    stateSinceSource: stateSince.source,
    currentQuestion: current ?? null,
    destination: destination ?? null,
    history,
  }
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
  return (await getSessionScoreBreakdown(db, sessionId)).finalScore
}

export type SessionScoreBreakdown = {
  rawCorrectCount: number
  rawWrongCount: number
  approvedCorrectCount: number
  approvedReversedWrongCount: number
  correctCount: number
  wrongCount: number
  hintCount: number
  pointsPerCorrect: number
  wrongAnswerPenalty: number
  hintPenalty: number
  scoreBeforeApprovedReviews: number
  approvedReviewCorrection: number
  originalCalculatedScore: number
  manualAdjustmentTotal: number
  finalScore: number
}

/** Single authoritative score derivation used by gameplay, detail, ranking and analytics. */
export async function getSessionScoreBreakdown(db: D1Database, sessionId: number): Promise<SessionScoreBreakdown> {
  const row = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM answer_attempts WHERE session_id = ? AND correct = 1) AS rawCorrectCount,
    (SELECT COUNT(*) FROM answer_attempts WHERE session_id = ? AND correct = 0) AS rawWrongCount,
    (SELECT COALESCE(SUM(awarded_correct),0) FROM answer_review_requests WHERE session_id = ? AND status = 'APPROVED') AS approvedCorrectCount,
    (SELECT COALESCE(SUM(reversed_wrong),0) FROM answer_review_requests WHERE session_id = ? AND status = 'APPROVED') AS approvedReversedWrongCount,
    (SELECT COUNT(*) FROM question_hint_usage WHERE session_id = ?) AS hintCount,
    er.points_per_correct AS pointsPerCorrect,
    er.wrong_answer_penalty AS wrongAnswerPenalty,
    er.hint_penalty AS hintPenalty,
    (SELECT COALESCE(SUM(amount),0) FROM score_adjustments WHERE session_id = ?) AS manualAdjustmentTotal
    FROM sessions s JOIN event_runs er ON er.id = s.event_run_id WHERE s.id = ?
  `).bind(sessionId, sessionId, sessionId, sessionId, sessionId, sessionId, sessionId).first<any>()
  const rawCorrectCount = Number(row?.rawCorrectCount ?? 0)
  const rawWrongCount = Number(row?.rawWrongCount ?? 0)
  const approvedCorrectCount = Number(row?.approvedCorrectCount ?? 0)
  const approvedReversedWrongCount = Math.min(rawWrongCount, Number(row?.approvedReversedWrongCount ?? 0))
  const correctCount = rawCorrectCount + approvedCorrectCount
  const wrongCount = Math.max(0, rawWrongCount - approvedReversedWrongCount)
  const hintCount = Number(row?.hintCount ?? 0)
  const pointsPerCorrect = Number(row?.pointsPerCorrect ?? 100)
  const wrongAnswerPenalty = Number(row?.wrongAnswerPenalty ?? 10)
  const hintPenalty = Number(row?.hintPenalty ?? 5)
  const scoreBeforeApprovedReviews = Math.max(0, rawCorrectCount * pointsPerCorrect - rawWrongCount * wrongAnswerPenalty - hintCount * hintPenalty)
  const approvedReviewCorrection = approvedCorrectCount * pointsPerCorrect + approvedReversedWrongCount * wrongAnswerPenalty
  const originalCalculatedScore = Math.max(0, correctCount * pointsPerCorrect - wrongCount * wrongAnswerPenalty - hintCount * hintPenalty)
  const manualAdjustmentTotal = Number(row?.manualAdjustmentTotal ?? 0)
  return {
    rawCorrectCount, rawWrongCount, approvedCorrectCount, approvedReversedWrongCount,
    correctCount, wrongCount, hintCount, pointsPerCorrect, wrongAnswerPenalty, hintPenalty,
    scoreBeforeApprovedReviews, approvedReviewCorrection,
    originalCalculatedScore, manualAdjustmentTotal,
    finalScore: Math.max(0, originalCalculatedScore + manualAdjustmentTotal),
  }
}

export async function getCheckpointByFallbackCode(db: D1Database, code: string): Promise<CheckpointRow | null> {
  return await db.prepare('SELECT id, token, sequence_order, label, is_start FROM checkpoints WHERE fallback_code = ?').bind(code.trim().toUpperCase()).first<CheckpointRow>() ?? null
}
