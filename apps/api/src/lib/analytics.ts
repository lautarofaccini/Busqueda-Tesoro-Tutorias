import { parsePersistedUtc } from './timestamps.js'

type RunRow = {
  id: number
  name: string
  status: string
  createdAt: string
  startedAt: string | null
  closingAt: string | null
  endedAt: string | null
  pointsPerCorrect: number
  wrongAnswerPenalty: number
  hintPenalty: number
}

function runEffectiveStatus(run: RunRow, now = Date.now()) {
  if (run.status !== 'CLOSING') return run.status
  return run.closingAt && now >= parsePersistedUtc(run.closingAt) + 30 * 60 * 1000 ? 'ENDED' : 'CLOSING'
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function tiedMax<T>(items: T[], value: (item: T) => number) {
  if (!items.length) return { value: 0, items: [] as T[] }
  const maximum = Math.max(...items.map(value))
  return { value: maximum, items: items.filter(item => value(item) === maximum) }
}

export async function listEventRuns(db: D1Database) {
  const rows = await db.prepare(`SELECT er.id, er.name, er.status,
    er.created_at AS createdAt, er.started_at AS startedAt,
    er.closing_at AS closingAt, er.ended_at AS endedAt,
    er.id = es.current_event_run_id AS isCurrent,
    COUNT(s.id) AS participationCount
    FROM event_runs er CROSS JOIN event_settings es
    LEFT JOIN sessions s ON s.event_run_id = er.id
    WHERE es.id = 1 GROUP BY er.id ORDER BY er.id DESC`).all<any>()
  return (rows.results ?? []).map((run: any) => ({
    ...run,
    id: Number(run.id),
    isCurrent: Boolean(run.isCurrent),
    participationCount: Number(run.participationCount),
    effectiveStatus: runEffectiveStatus(run),
  }))
}

export async function getRunAnalytics(db: D1Database, runId: number) {
  const run = await db.prepare(`SELECT id, name, status, created_at AS createdAt,
    started_at AS startedAt, closing_at AS closingAt, ended_at AS endedAt,
    points_per_correct AS pointsPerCorrect,
    wrong_answer_penalty AS wrongAnswerPenalty, hint_penalty AS hintPenalty
    FROM event_runs WHERE id = ?`).bind(runId).first<RunRow>()
  if (!run) return null

  const [sessionRows, questionRows, checkpointRows] = await Promise.all([
    db.prepare(`WITH
      attempts AS (SELECT session_id,
        SUM(CASE WHEN correct=1 THEN 1 ELSE 0 END) AS rawCorrect,
        SUM(CASE WHEN correct=0 THEN 1 ELSE 0 END) AS rawWrong
        FROM answer_attempts GROUP BY session_id),
      reviews AS (SELECT session_id,
        SUM(CASE WHEN status='APPROVED' THEN awarded_correct ELSE 0 END) AS manualCorrect,
        SUM(CASE WHEN status='APPROVED' THEN reversed_wrong ELSE 0 END) AS reversedWrong,
        SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pendingReview
        FROM answer_review_requests GROUP BY session_id),
      hints AS (SELECT session_id, COUNT(*) AS hintsUsed FROM question_hint_usage GROUP BY session_id),
      adjustments AS (SELECT session_id, COALESCE(SUM(amount),0) AS manualAdjustmentTotal,
        COUNT(*) AS manualAdjustmentCount FROM score_adjustments GROUP BY session_id),
      steps AS (SELECT session_id, COUNT(*) AS totalSteps FROM session_steps GROUP BY session_id)
      SELECT s.id, s.participant_id AS participantId, s.player_name AS playerName,
        p.career, p.identifier_type AS identifierType, p.identifier_suffix AS identifierSuffix,
        s.status, s.current_step AS currentStep, s.unlocked_step AS unlockedStep,
        s.started_at AS startedAt, s.completed_at AS completedAt,
        s.invalidated_at AS invalidatedAt, s.invalidation_reason AS invalidationReason,
        s.audit_reviewed_at AS auditReviewedAt, s.audit_reviewed_by AS auditReviewedBy,
        COALESCE(a.rawCorrect,0) + COALESCE(r.manualCorrect,0) AS correctCount,
        MAX(0, COALESCE(a.rawWrong,0) - COALESCE(r.reversedWrong,0)) AS wrongCount,
        COALESCE(h.hintsUsed,0) AS hintsUsed, COALESCE(st.totalSteps,0) AS totalSteps,
        COALESCE(r.pendingReview,0) AS pendingReview,
        COALESCE(adj.manualAdjustmentTotal,0) AS manualAdjustmentTotal,
        COALESCE(adj.manualAdjustmentCount,0) AS manualAdjustmentCount
      FROM sessions s JOIN participants p ON p.id=s.participant_id
      LEFT JOIN attempts a ON a.session_id=s.id LEFT JOIN reviews r ON r.session_id=s.id
      LEFT JOIN hints h ON h.session_id=s.id LEFT JOIN steps st ON st.session_id=s.id
      LEFT JOIN adjustments adj ON adj.session_id=s.id
      WHERE s.event_run_id=? ORDER BY s.id`).bind(runId).all<any>(),
    db.prepare(`WITH first_ids AS (
        SELECT session_id, challenge_id, MIN(id) AS firstId FROM answer_attempts GROUP BY session_id, challenge_id
      ), first_attempts AS (
        SELECT a.session_id, a.challenge_id, a.correct FROM answer_attempts a JOIN first_ids f ON f.firstId=a.id
      ), wrongs AS (
        SELECT session_id, challenge_id, SUM(CASE WHEN correct=0 THEN 1 ELSE 0 END) AS wrongCount
        FROM answer_attempts GROUP BY session_id, challenge_id
      )
      SELECT ch.id AS questionId, ch.question_text AS question, cp.id AS checkpointId,
        cp.label AS checkpoint, COUNT(DISTINCT sca.session_id) AS received,
        SUM(CASE WHEN fa.correct=1 THEN 1 ELSE 0 END) AS firstAttemptCorrect,
        COALESCE(SUM(w.wrongCount),0) AS wrongAttempts,
        COUNT(DISTINCT qhu.session_id) AS hintUses
      FROM session_challenge_assignments sca
      JOIN sessions s ON s.id=sca.session_id AND s.event_run_id=? AND s.invalidated_at IS NULL
      JOIN challenges ch ON ch.id=sca.challenge_id JOIN checkpoints cp ON cp.id=ch.checkpoint_id
      LEFT JOIN first_attempts fa ON fa.session_id=sca.session_id AND fa.challenge_id=sca.challenge_id
      LEFT JOIN wrongs w ON w.session_id=sca.session_id AND w.challenge_id=sca.challenge_id
      LEFT JOIN question_hint_usage qhu ON qhu.session_id=sca.session_id AND qhu.challenge_id=sca.challenge_id
      GROUP BY ch.id ORDER BY cp.id, ch.id`).bind(runId).all<any>(),
    db.prepare(`WITH reached AS (
        SELECT DISTINCT sca.session_id, ch.checkpoint_id
        FROM session_challenge_assignments sca JOIN sessions s ON s.id=sca.session_id
        JOIN challenges ch ON ch.id=sca.challenge_id
        WHERE s.event_run_id=? AND s.invalidated_at IS NULL
      ), wrongs AS (
        SELECT a.session_id, ch.checkpoint_id, COUNT(*) AS wrongCount
        FROM answer_attempts a JOIN sessions s ON s.id=a.session_id
        JOIN challenges ch ON ch.id=a.challenge_id
        WHERE s.event_run_id=? AND s.invalidated_at IS NULL AND a.correct=0
        GROUP BY a.session_id, ch.checkpoint_id
      ), hints AS (
        SELECT q.session_id, ch.checkpoint_id, COUNT(*) AS hintCount
        FROM question_hint_usage q JOIN sessions s ON s.id=q.session_id
        JOIN challenges ch ON ch.id=q.challenge_id
        WHERE s.event_run_id=? AND s.invalidated_at IS NULL
        GROUP BY q.session_id, ch.checkpoint_id
      )
      SELECT cp.id AS checkpointId, cp.label AS checkpoint, COUNT(r.session_id) AS reached,
        COALESCE(SUM(w.wrongCount),0) AS wrongAttempts,
        COALESCE(SUM(h.hintCount),0) AS hintUses
      FROM reached r JOIN checkpoints cp ON cp.id=r.checkpoint_id
      LEFT JOIN wrongs w ON w.session_id=r.session_id AND w.checkpoint_id=r.checkpoint_id
      LEFT JOIN hints h ON h.session_id=r.session_id AND h.checkpoint_id=r.checkpoint_id
      GROUP BY cp.id ORDER BY cp.id`).bind(runId, runId, runId).all<any>(),
  ])

  const effectiveStatus = runEffectiveStatus(run)
  const players = (sessionRows.results ?? []).map((row: any) => {
    const correctCount = Number(row.correctCount)
    const wrongCount = Number(row.wrongCount)
    const hintsUsed = Number(row.hintsUsed)
    const originalCalculatedScore = Math.max(0, correctCount * Number(run.pointsPerCorrect)
      - wrongCount * Number(run.wrongAnswerPenalty) - hintsUsed * Number(run.hintPenalty))
    const manualAdjustmentTotal = Number(row.manualAdjustmentTotal ?? 0)
    const score = Math.max(0, originalCalculatedScore + manualAdjustmentTotal)
    const completed = row.status === 'completed' && row.completedAt
    return {
      ...row,
      id: Number(row.id), participantId: Number(row.participantId), correctCount, wrongCount, hintsUsed,
      totalSteps: Number(row.totalSteps), pendingReview: Boolean(row.pendingReview), score,
      originalCalculatedScore, manualAdjustmentTotal,
      manualAdjustmentCount: Number(row.manualAdjustmentCount ?? 0),
      auditStatus: row.auditReviewedAt ? 'REVIEWED' : 'PENDING',
      durationSec: completed ? Math.max(0, Math.floor((parsePersistedUtc(row.completedAt) - parsePersistedUtc(row.startedAt)) / 1000)) : null,
      resultStatus: row.status === 'completed' ? 'COMPLETED' : effectiveStatus === 'ENDED' ? 'INCOMPLETE' : 'IN_PROGRESS',
    }
  })
  const valid = players.filter((player: any) => !player.invalidatedAt)
  const completed = valid.filter((player: any) => player.resultStatus === 'COMPLETED')
  const incomplete = valid.filter((player: any) => player.resultStatus === 'INCOMPLETE')
  const active = valid.filter((player: any) => player.resultStatus === 'IN_PROGRESS')
  const invalidated = players.filter((player: any) => player.invalidatedAt)

  const ranking = completed.slice().sort((a: any, b: any) => b.score - a.score || a.id - b.id)
  ranking.forEach((player: any, index: number) => {
    player.rank = index > 0 && player.score === ranking[index - 1].score ? ranking[index - 1].rank : index + 1
    player.isTied = ranking.some((other: any) => other.id !== player.id && other.score === player.score)
  })

  const careerMap = new Map<string, any[]>()
  players.forEach((player: any) => {
    const career = player.career || 'Sin informar'
    careerMap.set(career, [...(careerMap.get(career) ?? []), player])
  })
  const careers = [...careerMap].map(([career, members]) => {
    const careerValid = members.filter(player => !player.invalidatedAt)
    const careerCompleted = careerValid.filter(player => player.resultStatus === 'COMPLETED')
    const careerIncomplete = careerValid.filter(player => player.resultStatus === 'INCOMPLETE')
    const sum = (field: string, rows = careerValid) => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0)
    return {
      career, participants: members.length,
      sharePercent: players.length ? round(members.length * 100 / players.length) : 0,
      validParticipants: careerValid.length,
      invalidated: members.length - careerValid.length,
      completed: careerCompleted.length, incomplete: careerIncomplete.length,
      completionRate: careerValid.length ? round(careerCompleted.length * 100 / careerValid.length) : 0,
      totalScore: sum('score', careerCompleted),
      averageScore: careerCompleted.length ? round(sum('score', careerCompleted) / careerCompleted.length) : null,
      scoreSample: careerCompleted.length,
      averageWrongAnswers: careerValid.length ? round(sum('wrongCount') / careerValid.length) : 0,
      averageQuestionHints: careerValid.length ? round(sum('hintsUsed') / careerValid.length) : 0,
      behaviorSample: careerValid.length,
      averageCompletionDurationSec: careerCompleted.length ? Math.round(sum('durationSec', careerCompleted) / careerCompleted.length) : null,
      durationSample: careerCompleted.length,
    }
  }).sort((a, b) => b.participants - a.participants || a.career.localeCompare(b.career))

  const total = (field: string) => completed.reduce((sum: number, row: any) => sum + Number(row[field] ?? 0), 0)
  const sortedScores = completed.map((row: any) => row.score).sort((a: number, b: number) => a - b)
  const medianScore = sortedScores.length ? (sortedScores[Math.floor((sortedScores.length - 1) / 2)] + sortedScores[Math.floor(sortedScores.length / 2)]) / 2 : null
  const mostParticipation = tiedMax(careers, row => row.participants)
  const mostTotalScore = tiedMax(careers, row => row.totalScore)
  const scoredCareers = careers.filter(row => row.averageScore !== null)
  const mostAverageScore = tiedMax(scoredCareers, row => row.averageScore ?? 0)

  return {
    run: { ...run, effectiveStatus },
    totals: { all: players.length, valid: valid.length, completed: completed.length, incomplete: incomplete.length,
      active: active.length, invalidated: invalidated.length,
      completionRate: valid.length ? round(completed.length * 100 / valid.length) : 0 },
    ranking, active, incomplete, invalidated, careers,
    highlights: {
      mostParticipation: { value: mostParticipation.value, careers: mostParticipation.items.map(row => row.career) },
      mostTotalScore: { value: mostTotalScore.value, careers: mostTotalScore.items.map(row => row.career) },
      mostAverageScore: { value: mostAverageScore.value, careers: mostAverageScore.items.map(row => row.career) },
    },
    globalPerformance: {
      sample: completed.length,
      averageCompletedScore: completed.length ? round(total('score') / completed.length) : null,
      medianCompletedScore: medianScore,
      averageWrongAnswers: valid.length ? round(valid.reduce((n: number, row: any) => n + row.wrongCount, 0) / valid.length) : 0,
      averageHints: valid.length ? round(valid.reduce((n: number, row: any) => n + row.hintsUsed, 0) / valid.length) : 0,
      averageCompletionDurationSec: completed.length ? Math.round(total('durationSec') / completed.length) : null,
      fastestCompletionSec: completed.length ? Math.min(...completed.map((row: any) => row.durationSec)) : null,
      completionRate: valid.length ? round(completed.length * 100 / valid.length) : 0,
    },
    questions: (questionRows.results ?? []).map((row: any) => ({ ...row,
      received: Number(row.received), firstAttemptCorrect: Number(row.firstAttemptCorrect),
      firstAttemptCorrectRate: Number(row.received) ? round(Number(row.firstAttemptCorrect) * 100 / Number(row.received)) : 0,
      wrongAttempts: Number(row.wrongAttempts), hintUses: Number(row.hintUses),
      hintUseRate: Number(row.received) ? round(Number(row.hintUses) * 100 / Number(row.received)) : 0,
    })),
    checkpoints: (checkpointRows.results ?? []).map((row: any) => ({ ...row,
      reached: Number(row.reached), wrongAttempts: Number(row.wrongAttempts), hintUses: Number(row.hintUses),
      averageWrongAttempts: Number(row.reached) ? round(Number(row.wrongAttempts) / Number(row.reached)) : 0,
    })),
    feedback: [],
    semantics: {
      totals: 'Participantes totales incluye todas las sesiones iniciadas. Las invalidadas se muestran aparte y no integran ranking ni métricas competitivas.',
      averages: 'Puntaje y duración usan solo finalistas válidos; errores y pistas usan todas las participaciones válidas.',
      checkpointReach: 'Se considera alcanzado cuando quedó registrada una asignación de pregunta para ese checkpoint.',
      feedback: 'No existe una tabla ni un flujo histórico de opiniones; los pedidos de soporte no se reinterpretan como feedback.',
    },
  }
}
