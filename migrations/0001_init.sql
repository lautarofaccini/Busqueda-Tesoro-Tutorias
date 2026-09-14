-- Migration 0001: Initial schema
-- Project: busqueda-tesoro-tutorias
-- Phase 0: defined but NOT applied to any environment yet.
-- Apply with: wrangler d1 execute busqueda-tesoro-db --file=migrations/0001_init.sql

-- Checkpoints: one row per physical QR location in the hunt.
CREATE TABLE IF NOT EXISTS checkpoints (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  token          TEXT    NOT NULL UNIQUE,    -- opaque token embedded in QR URL
  sequence_order INTEGER NOT NULL,           -- position in the hunt (1-based)
  label          TEXT,                       -- internal organiser label, never sent to clients
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Sessions: one per participating player.
CREATE TABLE IF NOT EXISTS sessions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name           TEXT    NOT NULL,
  current_checkpoint_id INTEGER REFERENCES checkpoints(id),
  started_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at          TEXT                                         -- NULL while in progress
);

-- Attempts: every checkpoint scan, correct or not.
CREATE TABLE IF NOT EXISTS attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES sessions(id),
  checkpoint_id INTEGER NOT NULL REFERENCES checkpoints(id),
  scanned_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  correct       INTEGER NOT NULL DEFAULT 0   -- 0 = wrong order, 1 = correct
);

CREATE INDEX IF NOT EXISTS idx_attempts_session_id ON attempts (session_id);
