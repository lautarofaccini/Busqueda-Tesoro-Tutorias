-- LOCAL DEMO SEED DATA — busqueda-tesoro-tutorias
-- ⚠ FOR LOCAL DEVELOPMENT ONLY. Never apply to production.
-- Apply with: wrangler d1 execute busqueda-tesoro-db --local --file=../../migrations/seed_demo.sql
--
-- Tokens are fixed opaque values — they do NOT encode checkpoint name,
-- position, answer, or any game information.

-- ── Checkpoints ───────────────────────────────────────────────────────────
-- Token column and is_start column come from migrations 0001 + 0002.
INSERT INTO checkpoints (token, sequence_order, label, is_start) VALUES
  ('h7Xm2pL9qR3wK8nT', 0, '[DEMO] Tutorías — Inicio',       1),
  ('v4Nj6dF1mQ5yW2bG', 1, '[DEMO] Checkpoint A',            0),
  ('s9Kp8eA3cZ7xR4nL', 2, '[DEMO] Checkpoint B — Final',    0);

-- ── Routes ────────────────────────────────────────────────────────────────
INSERT INTO routes (name) VALUES
  ('[DEMO] Ruta Demo Local');

-- ── Route steps ───────────────────────────────────────────────────────────
-- clue_text is what the player sees AFTER starting / after completing prev step.
-- It tells them where to go to find the NEXT QR.
INSERT INTO route_steps (route_id, position, checkpoint_id, clue_text) VALUES
  (1, 1,
   (SELECT id FROM checkpoints WHERE token = 'v4Nj6dF1mQ5yW2bG'),
   '[DEMO] Primera pista: buscá el código QR marcado "DEMO A" en el lugar de prueba.'),
  (1, 2,
   (SELECT id FROM checkpoints WHERE token = 's9Kp8eA3cZ7xR4nL'),
   '[DEMO] Segunda pista: buscá el código QR marcado "DEMO B" para terminar el recorrido.');

-- ── Challenges ────────────────────────────────────────────────────────────
-- accepted_answers: JSON array — canonical first, then aliases (all pre-normalised).
-- NEVER returned to clients.
INSERT INTO challenges (checkpoint_id, question_text, accepted_answers) VALUES
  ((SELECT id FROM checkpoints WHERE token = 'v4Nj6dF1mQ5yW2bG'),
   '[DEMO] Ingresá la palabra naranja.',
   '["naranja"]'),
  ((SELECT id FROM checkpoints WHERE token = 's9Kp8eA3cZ7xR4nL'),
   '[DEMO] Ingresá el número 40.',
   '["40", "cuarenta"]');
