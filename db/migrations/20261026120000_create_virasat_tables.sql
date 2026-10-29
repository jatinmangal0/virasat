-- Same tables as server/lib/db.js (SQLite), in Postgres. Times stay as 'YYYY-MM-DD HH:MM:SS' UTC text
-- so the browser reads them the same way; expiry times are epoch milliseconds.
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE,
  google_sub    TEXT UNIQUE,
  avatar        TEXT,
  password_hash TEXT,
  created_at    TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  last_login_at TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  expires_at BIGINT NOT NULL
);

CREATE TABLE otps (
  phone      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    BIGINT NOT NULL
);

CREATE TABLE visits (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city     TEXT NOT NULL,
  first_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  last_at  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),
  count    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, city)
);

CREATE TABLE quiz_results (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city       TEXT NOT NULL,
  score      INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX sessions_user_id ON sessions (user_id);
CREATE INDEX quiz_results_user_id ON quiz_results (user_id);
