/**
 * POST /api/challenge/:challengeId/answer
 *
 * Security validation chain (in order):
 *  1. Session cookie must resolve to an active session.
 *  2. Challenge must exist.
 *  3. Challenge must belong to the session's CURRENT expected checkpoint.
 *     Prevents replay of an old challengeId from a previous step.
 *  4. Challenge must be unlocked: unlocked_step must equal current_step.
 *     Prevents submitting an answer before physically scanning the checkpoint.
 *     Also prevents replay — after advancing, unlocked_step becomes NULL.
 *  5. Answer is normalized before comparison.
 *  6. Idempotency: correct answer → advance exactly one step and clear unlock.
 *     A second submission after advancing hits check #3 or #4 and is rejected.
 *
 * accepted_answers are NEVER included in any response.
 *
 * No scoring is calculated in Phase 1.
 * All raw data (started_at, completed_at, attempts) is preserved for future ranking.
 * TODO: define score calculation, winner/tie rules, penalty rules in a future phase.
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { answerSubmitSchema, matchesAcceptedAnswers } from '@busqueda-tesoro/shared'
import type { Env } from '../env.d'
import {
  getActiveSession,
  getSessionStep,
  getAssignedChallenge,
  logAnswerAttempt,
  advanceStep,
  hasUsedHint,
  hasUsedQuestionHint,
  getSessionScore,
  completeSession,
  getSessionTotalSteps,
  getEventSettings,
} from '../db/queries.js'
import { getSessionToken, buildSessionCookie } from '../lib/cookies.js'
import { buildGameState } from '../lib/game-state.js'
import { parsePersistedUtc } from '../lib/timestamps.js'
import { getExistingSessionLifecycle, withClosingGrace } from '../lib/event-lifecycle.js'

const answerRoutes = new Hono<{ Bindings: Env }>()

answerRoutes.post(
  '/:challengeId/answer',
  zValidator('json', answerSubmitSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: 'VALIDATION_ERROR', issues: result.error.issues }, 400)
    }
  }),
  async (c) => {
    const now = Date.now()
    const rawId = c.req.param('challengeId')
    const challengeId = parseInt(rawId, 10)
    if (isNaN(challengeId)) {
      return c.json({ error: 'INVALID_CHALLENGE_ID' }, 400)
    }

    const { answer } = c.req.valid('json')

    // 1. Session check
    const cookieHeader = c.req.header('cookie') ?? null
    const sessionToken = getSessionToken(cookieHeader)
    if (!sessionToken) {
      return c.json({ error: 'NO_SESSION' }, 401)
    }

    const session = await getActiveSession(c.env.DB, sessionToken)
    if (!session) {
      return c.json({ error: 'SESSION_NOT_FOUND' }, 401)
    }

    const settings = await getEventSettings(c.env.DB)
    if (!settings) return c.json({ error: 'EVENT_NOT_LIVE' }, 403)
    const lifecycle = getExistingSessionLifecycle(settings, now)
    if (lifecycle === 'EVENT_PAUSED') return c.json({ state: 'EVENT_PAUSED' })
    if (lifecycle === 'EVENT_ENDED') return c.json({ state: 'EVENT_ENDED' })
    if (lifecycle === 'CLOSING_EXPIRED') return c.json({ state: 'CLOSING_EXPIRED' })
    if (lifecycle !== 'ALLOW') return c.json({ error: 'EVENT_NOT_LIVE' }, 403)

    // 2. Challenge must be unlocked (player must have scanned the checkpoint first)
    if (session.unlocked_step !== session.current_step) {
      return c.json({ error: 'CHALLENGE_NOT_UNLOCKED' }, 403)
    }

    // 3. Challenge must be assigned to this session for the CURRENT expected checkpoint
    // This inherently prevents replay of an old challengeId from a previous step,
    // and prevents substituting a different challenge from the same checkpoint's pool.
    const assignedChallenge = await getAssignedChallenge(c.env.DB, session.id, session.current_step)
    if (!assignedChallenge || assignedChallenge.id !== challengeId) {
      return c.json({ error: 'CHALLENGE_NOT_CURRENT' }, 403)
    }

    // Cooldown logic
    const lastAttempt = await c.env.DB.prepare('SELECT correct, attempted_at FROM answer_attempts WHERE session_id = ? AND challenge_id = ? ORDER BY id DESC LIMIT 1').bind(session.id, challengeId).first();
    if (lastAttempt && lastAttempt.correct === 0) {
      const msSince = Date.now() - parsePersistedUtc(lastAttempt.attempted_at as string);
      if (msSince < 10000) {
        return c.json({ error: 'COOLDOWN_ACTIVE', remainingSeconds: Math.ceil((10000 - msSince) / 1000) }, 429)
      }
    }

    // 5. Normalize and compare

    const acceptedAnswers = JSON.parse(assignedChallenge.accepted_answers) as string[]
    const [canonical, ...aliases] = acceptedAnswers
    const isCorrect = matchesAcceptedAnswers(answer, canonical ?? '', aliases)

    // 6. Log attempt
    const attemptId = await logAnswerAttempt(c.env.DB, {
      sessionId: session.id,
      challengeId: assignedChallenge.id,
      rawAnswer: answer,
      correct: isCorrect,
    })

    const totalSteps = await getSessionTotalSteps(c.env.DB, session.id)

    if (!isCorrect) {
      const usedHint = await hasUsedQuestionHint(c.env.DB, session.id, assignedChallenge.id)
      const score = await getSessionScore(c.env.DB, session.id)
      // No advancement, unlock preserved
      return c.json(withClosingGrace({
        state: 'ANSWER_INCORRECT',
        challengeId: assignedChallenge.id,
        question: assignedChallenge.question_text,
        stepNumber: session.current_step,
        totalSteps,
        playerName: session.player_name,
        score,
        hasHint: !!assignedChallenge.hint_text && !usedHint,
        hint: usedHint ? assignedChallenge.hint_text : undefined,
        cooldownRemaining: 10,
        attemptId,
      }, settings, now))
    }


    // Correct answer
    const isLastStep = session.current_step >= totalSteps

    if (isLastStep) {
      await completeSession(c.env.DB, session.id)
      const score = await getSessionScore(c.env.DB, session.id)
      const secure = c.env.ENVIRONMENT === 'production'
      c.header('Set-Cookie', buildSessionCookie(sessionToken, secure))
      return c.json({
        state: 'COMPLETED',
        playerName: session.player_name,
        completedAt: new Date().toISOString(),
        score,
      })
    }

    // Advance: current_step + 1, unlocked_step = NULL
    const nextStep = session.current_step + 1
    await advanceStep(c.env.DB, session.id, nextStep)

    const updatedSession = { ...session, current_step: nextStep, unlocked_step: null }

    const secure = c.env.ENVIRONMENT === 'production'
    c.header('Set-Cookie', buildSessionCookie(sessionToken, secure))

    const state = await buildGameState(c.env.DB, updatedSession)
    // Tag as ADVANCED to let client distinguish from a plain state recovery
    if (state.state === 'ACTIVE') {
      return c.json(withClosingGrace({ ...state, state: 'ADVANCED' as const }, settings, now))
    }
    return c.json(withClosingGrace(state, settings, now))
  }
)

export { answerRoutes }
