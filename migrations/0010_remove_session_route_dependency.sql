-- The gameplay route is session_steps. Rebuild sessions to remove obsolete
-- route_id -> routes(id) foreign key without changing participant/checkpoint FKs.
PRAGMA foreign_keys = OFF;
CREATE TABLE sessions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  current_checkpoint_id INTEGER REFERENCES checkpoints(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  session_token TEXT,
  current_step INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  unlocked_step INTEGER,
  participant_id INTEGER REFERENCES participants(id)
);
INSERT INTO sessions_new (id, player_name, current_checkpoint_id, started_at, completed_at, session_token, current_step, status, unlocked_step, participant_id)
SELECT id, player_name, current_checkpoint_id, started_at, completed_at, session_token, current_step, status, unlocked_step, participant_id FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;
CREATE UNIQUE INDEX idx_sessions_token ON sessions (session_token);
CREATE INDEX idx_sessions_status ON sessions (status);
PRAGMA foreign_keys = ON;
