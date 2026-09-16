-- Migration 0003: Persistent Question Pools
-- Implements multi-question pools per checkpoint and persistent per-session assignment.
-- Allows randomizing questions to deter answer-sharing.

-- 1. Add 'active' column to challenges table to allow enabling/disabling questions.
ALTER TABLE challenges ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- 2. Create the assignments table for persistent random selection.
CREATE TABLE IF NOT EXISTS session_challenge_assignments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   INTEGER NOT NULL REFERENCES sessions(id),
  route_step   INTEGER NOT NULL,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  assigned_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, route_step)
);

CREATE INDEX IF NOT EXISTS idx_assignments_session_step ON session_challenge_assignments (session_id, route_step);
