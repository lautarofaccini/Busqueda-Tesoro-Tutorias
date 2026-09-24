-- Realistic pre-0011 state: ended event with an invalidated historical participation.
UPDATE event_settings SET status = 'ENDED', updated_at = '2026-09-23 15:00:00' WHERE id = 1;
UPDATE participants SET identifier_hash = 'fe60390b1d3324b12103931753087b547309b65d85dffc26b8efe9775a5c29f3'
  WHERE id = 101;
UPDATE participants SET invalidated_at = '2026-09-23 15:05:00', invalidation_reason = 'Prueba de invalidación'
  WHERE id = 102;
