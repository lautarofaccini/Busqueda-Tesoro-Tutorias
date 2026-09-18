-- LOCAL DEMO SEED DATA (TEST EDITION)
INSERT OR REPLACE INTO event_settings (id, status, event_name, points_per_correct, wrong_answer_penalty) VALUES (1, 'LIVE', 'Test Event', 100, 10);
INSERT INTO checkpoints (token, sequence_order, label, is_start, primary_clue) VALUES
  ('h7Xm2pL9qR3wK8nT', 0, '[DEMO] Tutorías — Inicio',       1, NULL),
  ('v4Nj6dF1mQ5yW2bG', 1, '[DEMO] Checkpoint A',            0, '[DEMO] Primera pista: buscá el código QR marcado "DEMO A" en el lugar de prueba.'),
  ('s9Kp8eA3cZ7xR4nL', 2, '[DEMO] Checkpoint B — Final',    0, '[DEMO] Segunda pista: buscá el código QR marcado "DEMO B" para terminar el recorrido.');
INSERT INTO routes (name) VALUES ('[DEMO] Ruta Demo Local');
INSERT INTO route_steps (route_id, position, checkpoint_id, clue_text) VALUES
  (1, 1, (SELECT id FROM checkpoints WHERE token = 'v4Nj6dF1mQ5yW2bG'), '[DEMO] Primera pista: buscá el código QR marcado "DEMO A" en el lugar de prueba.'),
  (1, 2, (SELECT id FROM checkpoints WHERE token = 's9Kp8eA3cZ7xR4nL'), '[DEMO] Segunda pista: buscá el código QR marcado "DEMO B" para terminar el recorrido.');
INSERT INTO challenges (id, checkpoint_id, question_text, accepted_answers, active, hint_text) VALUES
  (100, 1, '[DEMO] Pregunta Tutorías', '["tutorias"]', 1, 'Pista Tutorías'),
  (1, 2, '[DEMO] Ingresá la palabra naranja.', '["naranja"]', 1, NULL),
  (2, 2, '[DEMO] Ingresá la palabra tutorias.', '["tutorias"]', 1, NULL),
  (3, 2, '[DEMO] Ingresá el número 25.', '["25"]', 1, NULL),
  (4, 3, '[DEMO] Ingresá el número 40.', '["40", "cuarenta"]', 1, NULL),
  (5, 3, '[DEMO] Ingresá la palabra final.', '["final"]', 1, NULL),
  (6, 3, '[DEMO] Ingresá la palabra exito.', '["exito"]', 1, NULL);
