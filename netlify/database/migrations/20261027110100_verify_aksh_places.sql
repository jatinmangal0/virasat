-- Jatin, 2026-10-29: Aksh's heritage places were already checked by a teammate when the workbooks were made,
-- so they go live without a second check on the editor page. This publishes every imported place nobody
-- has changed since the import (created_by and updated_by are NULL). verified_by stays NULL, meaning
-- "checked before import". Each one is written to content_log, so the History tab shows it.
-- A place an editor changes later goes back to needs_check, as usual.
WITH before AS (
  SELECT id, to_jsonb(p) AS row FROM heritage_places p
  WHERE status = 'needs_check' AND created_by IS NULL AND updated_by IS NULL
), done AS (
  UPDATE heritage_places p SET status = 'verified', verified_at = now()
  FROM before b WHERE p.id = b.id
  RETURNING p.*
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'verify', 'place', d.id::text, b.row, to_jsonb(d) FROM done d JOIN before b ON b.id = d.id;
