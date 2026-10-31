-- Jatin (31 Oct): a list of email addresses that are always admins. Whoever signs in with Google using one
-- of these addresses gets the admin view. Only Google sign-in counts, because Google has checked that the
-- person owns the address; an email typed at sign-up is never checked.
-- Add someone:    INSERT INTO admin_emails (email) VALUES ('name@example.com');
-- Remove someone: DELETE FROM admin_emails WHERE email = 'name@example.com';  (then set their role on the Team tab)
-- The ADMIN_EMAILS setting on Vercel (comma-separated) works the same way, on top of this table.
CREATE TABLE IF NOT EXISTS admin_emails (
  email    TEXT PRIMARY KEY CHECK (email = lower(email) AND email LIKE '%_@_%'),
  note     TEXT,
  added_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);
