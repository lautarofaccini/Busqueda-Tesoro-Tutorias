INSERT INTO participants (id, display_name, last_name, career, identifier_type, identifier_hash, identifier_suffix)
VALUES
  (101, 'Ana', 'Activa', 'ISI', 'DNI', 'hash-101', '101'),
  (102, 'Beto', 'Buscando', 'IQ', 'LEGAJO', 'hash-102', '102'),
  (103, 'Ceci', 'Completa', 'IEM', 'DNI', 'hash-103', '103');

INSERT INTO sessions (id, player_name, started_at, completed_at, session_token, current_step, status, unlocked_step, participant_id)
VALUES
  (201, 'Ana Activa', '2026-09-23 14:00:00', NULL, 'session-201', 1, 'active', 1, 101),
  (202, 'Beto Buscando', '2026-09-23 14:00:00', NULL, 'session-202', 1, 'active', NULL, 102),
  (203, 'Ceci Completa', '2026-09-23 14:00:00', '2026-09-23 14:10:00', 'session-203', 2, 'completed', NULL, 103);

INSERT INTO session_steps (session_id, position, checkpoint_id) VALUES
  (201, 1, 2), (201, 2, 3),
  (202, 1, 2), (202, 2, 3),
  (203, 1, 2), (203, 2, 3);

INSERT INTO session_challenge_assignments (session_id, route_step, challenge_id, assigned_at) VALUES
  (201, 0, 100, '2026-09-23 14:00:00'), (201, 1, 1, '2026-09-23 14:02:00'),
  (202, 0, 100, '2026-09-23 14:00:00'),
  (203, 0, 100, '2026-09-23 14:00:00'), (203, 1, 1, '2026-09-23 14:03:00'), (203, 2, 4, '2026-09-23 14:07:00');

INSERT INTO answer_attempts (id, session_id, challenge_id, raw_answer, correct, attempted_at) VALUES
  (301, 201, 100, 'tutorias', 1, '2026-09-23 14:01:00'),
  (302, 201, 1, 'rojo', 0, '2026-09-23 14:03:00'),
  (303, 201, 1, 'azul', 0, '2026-09-23 14:04:00'),
  (304, 202, 100, 'tutorias', 1, '2026-09-23 14:05:00'),
  (305, 203, 100, 'tutorias', 1, '2026-09-23 14:01:00'),
  (306, 203, 1, 'naranja', 1, '2026-09-23 14:05:00'),
  (307, 203, 4, 'treinta', 0, '2026-09-23 14:08:00'),
  (308, 203, 4, '40', 1, '2026-09-23 14:09:00');

INSERT INTO scan_events (session_id, checkpoint_id, raw_token, outcome, scanned_at) VALUES
  (201, 2, 'test', 'CHALLENGE', '2026-09-23 14:02:00'),
  (203, 2, 'test', 'CHALLENGE', '2026-09-23 14:03:00'),
  (203, 3, 'test', 'FALLBACK_CODE_CHALLENGE', '2026-09-23 14:07:00');

INSERT INTO question_hint_usage (session_id, challenge_id, used_at) VALUES (201, 1, '2026-09-23 14:03:30');
INSERT INTO hint_usage (session_id, step_position, used_at) VALUES (201, 1, '2026-09-23 14:01:30');

INSERT INTO answer_review_requests
  (session_id, participant_id, checkpoint_id, challenge_id, answer_attempt_id, raw_answer, normalized_answer, score_at_request, status, awarded_correct, reversed_wrong, created_at, resolved_at)
VALUES
  (201, 101, 2, 1, 302, 'rojo', 'rojo', 90, 'REJECTED', 0, 0, '2026-09-23 14:03:10', '2026-09-23 14:03:20'),
  (201, 101, 2, 1, 303, 'azul', 'azul', 80, 'PENDING', 0, 0, '2026-09-23 14:04:10', NULL),
  (203, 103, 3, 4, 307, 'treinta', 'treinta', 190, 'APPROVED', 0, 1, '2026-09-23 14:08:10', '2026-09-23 14:08:30');
