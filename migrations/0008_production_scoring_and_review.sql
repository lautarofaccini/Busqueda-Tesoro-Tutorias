-- Production scoring, question-hint audit trail, and content-review workflow.
CREATE TABLE IF NOT EXISTS question_hint_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  used_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, challenge_id)
);

ALTER TABLE challenges ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;
ALTER TABLE challenges ADD COLUMN review_note TEXT;

-- Final approved default: voluntary question hint costs 5 points.
UPDATE event_settings SET hint_penalty = 5 WHERE id = 1;
