import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE,
      phone         TEXT UNIQUE,
      google_sub    TEXT UNIQUE,
      avatar        TEXT,
      password_hash TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS otps (
      phone      TEXT PRIMARY KEY,
      code_hash  TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      sent_at    INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS visits (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      city       TEXT NOT NULL,
      first_at   TEXT NOT NULL DEFAULT (datetime('now')),
      last_at    TEXT NOT NULL DEFAULT (datetime('now')),
      count      INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, city)
    );
    CREATE TABLE IF NOT EXISTS quiz_results (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      city       TEXT NOT NULL,
      score      INTEGER NOT NULL,
      total      INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}
