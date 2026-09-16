-- Migration 0006: Checkpoint Clues and Instructions

ALTER TABLE checkpoints ADD COLUMN instruction TEXT;
ALTER TABLE checkpoints ADD COLUMN primary_clue TEXT;
ALTER TABLE checkpoints ADD COLUMN secondary_clue TEXT;

-- Backfill existing data
UPDATE checkpoints SET primary_clue = label WHERE primary_clue IS NULL;

-- Hint Usage tracking
CREATE TABLE IF NOT EXISTS hint_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  step_position INTEGER NOT NULL,
  used_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, step_position)
);
