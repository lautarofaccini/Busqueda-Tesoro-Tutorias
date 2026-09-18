-- Player support, manual answer review, and physical fallback codes.
ALTER TABLE checkpoints ADD COLUMN fallback_code TEXT;
UPDATE checkpoints SET fallback_code = upper(substr(hex(randomblob(4)), 1, 8)) WHERE fallback_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS checkpoints_fallback_code_unique ON checkpoints(fallback_code);

CREATE TABLE IF NOT EXISTS answer_review_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  checkpoint_id INTEGER NOT NULL REFERENCES checkpoints(id),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  answer_attempt_id INTEGER NOT NULL REFERENCES answer_attempts(id),
  raw_answer TEXT NOT NULL,
  normalized_answer TEXT NOT NULL,
  score_at_request INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  awarded_correct INTEGER NOT NULL DEFAULT 0,
  reversed_wrong INTEGER NOT NULL DEFAULT 0,
  organizer_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  UNIQUE(answer_attempt_id)
);
CREATE INDEX IF NOT EXISTS answer_review_requests_status_idx ON answer_review_requests(status, created_at);

CREATE TABLE IF NOT EXISTS support_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  checkpoint_id INTEGER REFERENCES checkpoints(id),
  category TEXT NOT NULL CHECK(category IN ('ANSWER_REVIEW','QR_SCAN','QR_DAMAGED','OTHER')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RESOLVED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  organizer_note TEXT
);
CREATE INDEX IF NOT EXISTS support_requests_status_idx ON support_requests(status, created_at);
