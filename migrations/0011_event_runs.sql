-- Immutable event editions and historical scoring snapshots.
-- Existing production rows are preserved in place and assigned to Edition 1.

CREATE TABLE event_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','LIVE','PAUSED','CLOSING','ENDED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  closing_at TEXT,
  ended_at TEXT,
  points_per_correct INTEGER NOT NULL,
  wrong_answer_penalty INTEGER NOT NULL,
  hint_penalty INTEGER NOT NULL,
  minimum_expected_completion_minutes INTEGER NOT NULL DEFAULT 5
);

INSERT INTO event_runs (
  name, status, created_at, started_at, closing_at, ended_at,
  points_per_correct, wrong_answer_penalty, hint_penalty,
  minimum_expected_completion_minutes
)
SELECT
  'Edición 1 — ' || strftime('%d/%m/%Y', COALESCE(MIN(s.started_at), datetime('now')), '-3 hours'),
  CASE
    WHEN es.status = 'CLOSING' AND datetime(es.updated_at, '+30 minutes') <= datetime('now') THEN 'ENDED'
    ELSE es.status
  END,
  COALESCE(MIN(s.started_at), es.updated_at),
  MIN(s.started_at),
  CASE WHEN es.status = 'CLOSING' THEN es.updated_at ELSE NULL END,
  CASE
    WHEN es.status = 'ENDED' THEN es.updated_at
    WHEN es.status = 'CLOSING' AND datetime(es.updated_at, '+30 minutes') <= datetime('now')
      THEN datetime(es.updated_at, '+30 minutes')
    ELSE NULL
  END,
  es.points_per_correct,
  es.wrong_answer_penalty,
  es.hint_penalty,
  es.minimum_expected_completion_minutes
FROM event_settings es
LEFT JOIN sessions s ON 1 = 1
WHERE es.id = 1;

ALTER TABLE sessions ADD COLUMN event_run_id INTEGER REFERENCES event_runs(id);
ALTER TABLE sessions ADD COLUMN invalidated_at TEXT;
ALTER TABLE sessions ADD COLUMN invalidation_reason TEXT;
ALTER TABLE sessions ADD COLUMN audit_reviewed_at TEXT;
ALTER TABLE sessions ADD COLUMN audit_reviewed_by TEXT;

UPDATE sessions
SET event_run_id = (SELECT MIN(id) FROM event_runs),
    invalidated_at = (SELECT p.invalidated_at FROM participants p WHERE p.id = sessions.participant_id),
    invalidation_reason = (SELECT p.invalidation_reason FROM participants p WHERE p.id = sessions.participant_id);

ALTER TABLE event_settings ADD COLUMN current_event_run_id INTEGER REFERENCES event_runs(id);
UPDATE event_settings SET current_event_run_id = (SELECT MIN(id) FROM event_runs) WHERE id = 1;

CREATE INDEX idx_sessions_event_run ON sessions(event_run_id);
CREATE INDEX idx_sessions_run_status ON sessions(event_run_id, status);
CREATE UNIQUE INDEX idx_sessions_one_participation_per_run
  ON sessions(event_run_id, participant_id)
  WHERE participant_id IS NOT NULL AND status != 'abandoned';
CREATE INDEX idx_event_runs_created ON event_runs(created_at DESC);

-- Append-only manual score corrections. Historical attempts/reviews remain immutable.
CREATE TABLE score_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  amount INTEGER NOT NULL CHECK(amount IN (-10, -5, 5, 10)),
  reason TEXT NOT NULL CHECK(length(trim(reason)) >= 5),
  idempotency_key TEXT NOT NULL UNIQUE,
  related_attempt_id INTEGER REFERENCES answer_attempts(id),
  compensates_adjustment_id INTEGER REFERENCES score_adjustments(id),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_score_adjustments_session ON score_adjustments(session_id, created_at, id);

-- Enforce the ledger contract at the database boundary. Mistakes are corrected
-- by inserting a compensating row, never by rewriting or deleting history.
CREATE TRIGGER score_adjustments_no_update
BEFORE UPDATE ON score_adjustments
BEGIN
  SELECT RAISE(ABORT, 'score adjustments are append-only');
END;

CREATE TRIGGER score_adjustments_no_delete
BEFORE DELETE ON score_adjustments
BEGIN
  SELECT RAISE(ABORT, 'score adjustments are append-only');
END;
