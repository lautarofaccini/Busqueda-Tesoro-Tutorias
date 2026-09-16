-- Migration 0005: Participants and Session Order
-- Phase 3 Cleanup: Real user testing findings.

-- 1. Participants Table
-- Ensures 1 competitive participation per person while protecting privacy.
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  identifier_type TEXT NOT NULL, -- 'LEGAJO' or 'DNI'
  identifier_hash TEXT NOT NULL, -- HMAC(normalized, secret)
  identifier_suffix TEXT NOT NULL, -- Last 3 chars for admin
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  invalidated_at TEXT,
  invalidation_reason TEXT,
  UNIQUE(identifier_type, identifier_hash)
);

-- 2. Link Session to Participant
ALTER TABLE sessions ADD COLUMN participant_id INTEGER REFERENCES participants(id);

-- 3. Session Steps Snapshot
-- Replaces manual routes by freezing a randomized route for each session.
CREATE TABLE IF NOT EXISTS session_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  checkpoint_id INTEGER NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  UNIQUE(session_id, position),
  UNIQUE(session_id, checkpoint_id)
);
