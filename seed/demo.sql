-- LOCAL DEMO SEED DATA — busqueda-tesoro-tutorias
-- ⚠️ FOR LOCAL DEVELOPMENT ONLY. Never apply to production.
-- Apply with: npm run db:reset:local
--

-- ── Event Settings ──────────────────────────────────────────────────────────
INSERT OR REPLACE INTO event_settings (id, status, event_name, points_per_correct, wrong_answer_penalty, hint_penalty) 
VALUES (1, 'LIVE', '[DEMO] Evento de Prueba LAN', 100, 10, 5);

-- ── Checkpoints ─────────────────────────────────────────────────────────────
INSERT INTO checkpoints (id, token, sequence_order, label, is_start, active, primary_clue) VALUES
  (1, 'h7Xm2pL9qR3wK8nT', 0, 'Tutorías — Inicio',       1, 1, NULL),
  (2, 'v4Nj6dF1mQ5yW2bG', 1, 'DEMO A',                  0, 1, 'Buscá el código QR marcado "DEMO A" en tu red LAN.'),
  (3, 's9Kp8eA3cZ7xR4nL', 2, 'DEMO B',                  0, 1, 'Buscá el código QR marcado "DEMO B".'),
  (4, 'm2Tz5pX8cR1wL9qF', 3, 'DEMO C',                  0, 1, 'Último paso: buscá el código QR marcado "DEMO C".'),
  (5, 'k8Rn3mP5yW2bG7xF', 4, 'DEMO D',                  0, 1, 'Buscá el código QR marcado "DEMO D" en tu red LAN.');

-- ── Routes ────────────────────────────────────────────────────────────────
-- Route 1: A -> B -> C
INSERT INTO routes (id, name, active) VALUES
  (1, 'Ruta Demo 1 (A -> B -> C)', 1);

-- Route 2: D -> B -> A
INSERT INTO routes (id, name, active) VALUES
  (2, 'Ruta Demo 2 (D -> B -> A)', 1);

-- ── Route steps ───────────────────────────────────────────────────────────
-- Route 1
INSERT INTO route_steps (route_id, position, checkpoint_id, clue_text) VALUES
  (1, 1, 2, 'Buscá el código QR marcado "DEMO A" en tu red LAN.'),
  (1, 2, 3, 'Buscá el código QR marcado "DEMO B".'),
  (1, 3, 4, 'Último paso: buscá el código QR marcado "DEMO C".');

-- Route 2
INSERT INTO route_steps (route_id, position, checkpoint_id, clue_text) VALUES
  (2, 1, 5, 'Buscá el código QR marcado "DEMO D" en tu red LAN.'),
  (2, 2, 3, 'Buscá el código QR marcado "DEMO B".'),
  (2, 3, 2, 'Último paso: buscá el código QR marcado "DEMO A".');

-- ── Challenges ────────────────────────────────────────────────────────────
-- Demo A pool
INSERT INTO challenges (checkpoint_id, question_text, accepted_answers, active) VALUES
  (2, 'Ingresá la palabra azul.', '["azul"]', 1),
  (2, 'Ingresá la palabra rojo.', '["rojo"]', 1);

-- Demo B pool
INSERT INTO challenges (checkpoint_id, question_text, accepted_answers, active) VALUES
  (3, 'Ingresá el número cuarenta.', '["40", "cuarenta"]', 1),
  (3, 'Ingresá el número veinte.', '["20", "veinte"]', 1);

-- Demo C pool
INSERT INTO challenges (checkpoint_id, question_text, accepted_answers, active) VALUES
  (4, 'Ingresá la palabra éxito.', '["exito"]', 1);

-- Demo D pool
INSERT INTO challenges (checkpoint_id, question_text, accepted_answers, active) VALUES
  (5, 'Ingresá la palabra demo.', '["demo"]', 1);
