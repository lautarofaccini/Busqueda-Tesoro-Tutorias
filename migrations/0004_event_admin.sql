-- Migration 0004: Event Admin
-- Phase 3: Add event configuration and active status flags.

CREATE TABLE IF NOT EXISTS event_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Singleton
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, LIVE, PAUSED, ENDED
  event_name TEXT NOT NULL DEFAULT 'Búsqueda del Tesoro',
  points_per_correct INTEGER NOT NULL DEFAULT 100,
  wrong_answer_penalty INTEGER NOT NULL DEFAULT 10,
  hint_penalty INTEGER NOT NULL DEFAULT 5,
  minimum_expected_completion_minutes INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO event_settings (id, status) VALUES (1, 'DRAFT');

ALTER TABLE routes ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE checkpoints ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
