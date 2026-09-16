-- Migration 0002: Walking skeleton schema
-- Project: busqueda-tesoro-tutorias
-- Phase 1: adds routes, route_steps, challenges, scan_events, answer_attempts.
--          Extends sessions with session_token, route_id, current_step, status,
--          and unlocked_step (nullable — explicit challenge unlock state).
-- Apply with: wrangler d1 migrations apply busqueda-tesoro-db --local

-- ── Extend sessions ────────────────────────────────────────────────────────
-- Add columns to the sessions table created in 0001.
-- SQLite only supports ADD COLUMN in ALTER TABLE.

ALTER TABLE sessions ADD COLUMN session_token TEXT;
ALTER TABLE sessions ADD COLUMN route_id INTEGER REFERENCES routes(id);
ALTER TABLE sessions ADD COLUMN current_step INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
-- status: 'active' | 'completed' | 'abandoned'
ALTER TABLE sessions ADD COLUMN unlocked_step INTEGER;
-- unlocked_step: NULL = player travelling to checkpoint
--                N    = player has scanned checkpoint for route step N
--                       Answer submissions are only valid when unlocked_step = current_step
-- This is the primary source of truth for challenge unlock state.
-- scan_events is the audit log, NOT the source of truth.

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);

-- ── Extend checkpoints ─────────────────────────────────────────────────────
ALTER TABLE checkpoints ADD COLUMN is_start INTEGER NOT NULL DEFAULT 0;
-- is_start: 1 = this is the start QR (Tutorías). Not a route step.

-- ── Routes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Route steps ───────────────────────────────────────────────────────────
-- Ordered steps after the start. Step 1 = first non-start checkpoint.
-- Tutorías is NOT a route step.
-- clue_text is shown AFTER starting (or after completing the previous step),
-- leading the player to reach checkpoint at this position.
CREATE TABLE IF NOT EXISTS route_steps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id      INTEGER NOT NULL REFERENCES routes(id),
  position      INTEGER NOT NULL,            -- 1-based
  checkpoint_id INTEGER NOT NULL REFERENCES checkpoints(id),
  clue_text     TEXT    NOT NULL,
  UNIQUE (route_id, position)
);

-- ── Challenges ────────────────────────────────────────────────────────────
-- One challenge per checkpoint.
-- accepted_answers: JSON array — canonical first, then aliases (all pre-normalised).
-- NEVER returned to clients.
CREATE TABLE IF NOT EXISTS challenges (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  checkpoint_id    INTEGER NOT NULL REFERENCES checkpoints(id),
  question_text    TEXT    NOT NULL,    -- safe to show to player
  accepted_answers TEXT    NOT NULL,    -- JSON array — NEVER sent to client
  hint_text        TEXT,               -- optional (may be sent if unlocked in future)
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_challenges_checkpoint ON challenges (checkpoint_id);

-- ── Scan events ───────────────────────────────────────────────────────────
-- Audit log only. NOT the source of truth for game state.
-- Use sessions.unlocked_step for current unlock status.
CREATE TABLE IF NOT EXISTS scan_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER REFERENCES sessions(id),     -- NULL if no session
  checkpoint_id INTEGER REFERENCES checkpoints(id),  -- NULL if token unknown
  raw_token     TEXT    NOT NULL,
  outcome       TEXT    NOT NULL,
  -- NEEDS_START | START_ALLOWED | SESSION_STARTED | WRONG_CHECKPOINT | CHALLENGE
  -- CHALLENGE_RESCANNED | START_RESCANNED | UNKNOWN_TOKEN | ALREADY_COMPLETED
  scanned_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scan_events_session ON scan_events (session_id);

-- ── Answer attempts ───────────────────────────────────────────────────────
-- Audit log for every submission (correct or wrong).
-- Preserves raw_answer for future anti-cheat review.
-- TODO (future phase): define score calculation, penalty rules, winner/tie rules.
CREATE TABLE IF NOT EXISTS answer_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   INTEGER NOT NULL REFERENCES sessions(id),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  raw_answer   TEXT    NOT NULL,    -- as submitted (for audit)
  correct      INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_answer_attempts_session ON answer_attempts (session_id);
