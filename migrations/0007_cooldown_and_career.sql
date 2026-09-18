-- Migration 0007: Participant onboarding fields
ALTER TABLE participants ADD COLUMN last_name TEXT;
ALTER TABLE participants ADD COLUMN career TEXT;

-- We don't actually need new schema for Cooldown, it's enforced dynamically from answer_attempts timestamps.
