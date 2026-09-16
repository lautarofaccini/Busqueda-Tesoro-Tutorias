-- LOCAL DEMO SEED DATA — busqueda-tesoro-tutorias (TEST EDITION)
INSERT OR REPLACE INTO event_settings (id, status, event_name, points_per_correct, wrong_answer_penalty) VALUES (1, 'LIVE', 'Test Event', 100, 10);
INSERT INTO checkpoints (token, sequence_order, label, is_start) VALUES
  ('h7Xm2pL9qR3wK8nT', 0, '[DEMO] Tutorías — Inicio',       1),
  ('v4Nj6dF1mQ5yW2bG', 1, '[DEMO] Checkpoint A',            0),
  ('s9Kp8eA3cZ7xR4nL', 2, '[DEMO] Checkpoint B — Final',    0);
INSERT INTO routes (name) VALUES ('[DEMO] Ruta Demo Local');
INSERT INTO route_steps (route_id, position, checkpoint_id, clue_text) VALUES
  (1, 1, (SELECT id FROM checkpoints WHERE token = 'v4Nj6dF1mQ5yW2bG'), '[DEMO] Primera pista: buscá el código QR marcado "DEMO A" en el lugar de prueba.'),
  (1, 2, (SELECT id FROM checkpoints WHERE token = 's9Kp8eA3cZ7xR4nL'), '[DEMO] Segunda pista: buscá el código QR marcado "DEMO B" para terminar el recorrido.');
INSERT INTO challenges (id, checkpoint_id, question_text, accepted_answers, active) VALUES
  (1, 2, '[DEMO] Ingresá la palabra naranja.', '["naranja"]', 1),
  (2, 2, '[DEMO] Ingresá la palabra tutorias.', '["tutorias"]', 1),
  (3, 2, '[DEMO] Ingresá el número 25.', '["25"]', 1),
  (4, 3, '[DEMO] Ingresá el número 40.', '["40", "cuarenta"]', 1),
  (5, 3, '[DEMO] Ingresá la palabra final.', '["final"]', 1),
  (6, 3, '[DEMO] Ingresá la palabra exito.', '["exito"]', 1);
