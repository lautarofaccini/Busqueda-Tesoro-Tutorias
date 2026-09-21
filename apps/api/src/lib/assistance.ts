import { advanceStep, completeSession, getSessionTotalSteps } from '../db/queries.js'

export type AssistanceDecision = { approve: boolean; addAlias?: boolean | undefined; note?: string | undefined }

export async function getAssistanceFeed(db: D1Database) {
  const reviews = await db.prepare(`
    SELECT r.*, p.display_name, cp.label, ch.question_text, ch.accepted_answers
    FROM answer_review_requests r
    JOIN participants p ON p.id = r.participant_id
    JOIN checkpoints cp ON cp.id = r.checkpoint_id
    JOIN challenges ch ON ch.id = r.challenge_id
  `).all<any>()
  const support = await db.prepare(`
    SELECT r.*, p.display_name, cp.label
    FROM support_requests r
    JOIN participants p ON p.id = r.participant_id
    LEFT JOIN checkpoints cp ON cp.id = r.checkpoint_id
  `).all<any>()

  const items = [
    ...reviews.results.map((item: any) => {
      const answers = JSON.parse(item.accepted_answers || '[]') as string[]
      return {
        ...item,
        kind: 'ANSWER_REVIEW' as const,
        actionable: item.status === 'PENDING',
        canonical_answer: answers[0] ?? '',
        accepted_aliases: answers.slice(1),
      }
    }),
    ...support.results.map((item: any) => ({
      ...item,
      kind: 'SUPPORT' as const,
      actionable: item.status === 'PENDING',
    })),
  ].sort((left, right) => {
    if (left.actionable !== right.actionable) return left.actionable ? -1 : 1
    const byDate = new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    return byDate || Number(right.id) - Number(left.id)
  })

  return { pendingCount: items.filter(item => item.actionable).length, items }
}

export async function resolveAnswerReview(db: D1Database, id: number, decision: AssistanceDecision) {
  const review = await db.prepare('SELECT * FROM answer_review_requests WHERE id = ?').bind(id).first<any>()
  if (!review) return { status: 404 as const, body: { error: 'NOT_FOUND' } }
  if (review.status !== 'PENDING') return { status: 200 as const, body: { success: true, idempotent: true } }

  if (!decision.approve) {
    await db.prepare("UPDATE answer_review_requests SET status='REJECTED', organizer_note=?, resolved_at=datetime('now') WHERE id=? AND status='PENDING'").bind(decision.note ?? null, id).run()
    return { status: 200 as const, body: { success: true, status: 'REJECTED', scoreCorrection: 0 } }
  }

  const subsequentCorrect = await db.prepare('SELECT 1 FROM answer_attempts WHERE session_id=? AND challenge_id=? AND correct=1 LIMIT 1').bind(review.session_id, review.challenge_id).first()
  const awardedCorrect = subsequentCorrect ? 0 : 1
  await db.prepare("UPDATE answer_review_requests SET status='APPROVED', awarded_correct=?, reversed_wrong=1, organizer_note=?, resolved_at=datetime('now') WHERE id=? AND status='PENDING'").bind(awardedCorrect, decision.note ?? null, id).run()

  if (decision.addAlias && review.normalized_answer) {
    const challenge = await db.prepare('SELECT accepted_answers FROM challenges WHERE id=?').bind(review.challenge_id).first<{ accepted_answers: string }>()
    if (challenge) {
      const answers = JSON.parse(challenge.accepted_answers) as string[]
      if (!answers.includes(review.normalized_answer)) {
        answers.push(review.normalized_answer)
        await db.prepare('UPDATE challenges SET accepted_answers=? WHERE id=?').bind(JSON.stringify(answers), review.challenge_id).run()
      }
    }
  }

  if (awardedCorrect) {
    const session = await db.prepare('SELECT current_step, unlocked_step, status FROM sessions WHERE id=?').bind(review.session_id).first<any>()
    const assigned = session && await db.prepare('SELECT challenge_id FROM session_challenge_assignments WHERE session_id=? AND route_step=?').bind(review.session_id, session.current_step).first<any>()
    if (session?.status === 'active' && session.unlocked_step === session.current_step && assigned?.challenge_id === review.challenge_id) {
      const total = await getSessionTotalSteps(db, review.session_id)
      if (session.current_step >= total) await completeSession(db, review.session_id)
      else await advanceStep(db, review.session_id, session.current_step + 1)
    }
  }

  return { status: 200 as const, body: { success: true, status: 'APPROVED', awardedCorrect: !!awardedCorrect } }
}

export async function resolveSupportRequest(db: D1Database, id: number, note?: string) {
  await db.prepare("UPDATE support_requests SET status='RESOLVED', organizer_note=?, resolved_at=datetime('now') WHERE id=? AND status='PENDING'").bind(note ?? null, id).run()
  return { success: true, status: 'RESOLVED' }
}
