-- Version 2 of the database: the site's information moves out of content.js into tables,
-- people get roles (learner / editor / admin), and learners earn points.
-- Earlier migrations have already run on the live site; never edit them, add a new file instead.

-- ---------------------------------------------------------------- people
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'learner'
  CHECK (role IN ('learner', 'editor', 'admin'));

-- ---------------------------------------------------------------- content
-- One row per city. The letter, quick facts and letter sources are short lists, kept as JSON.
CREATE TABLE cities (
  id            TEXT PRIMARY KEY,                    -- 'udaipur', used in URLs and asset names
  name          TEXT NOT NULL,
  native_name   TEXT NOT NULL DEFAULT '',            -- e.g. उदयपुर
  state         TEXT NOT NULL DEFAULT '',
  nickname      TEXT NOT NULL DEFAULT '',
  accent        TEXT NOT NULL DEFAULT '#2b45a6',     -- colour used on the letter
  stamp         TEXT NOT NULL,                       -- image path, e.g. assets/stamp-udaipur.png
  poster        TEXT NOT NULL,
  greeting      TEXT NOT NULL DEFAULT '',
  greeting_note TEXT NOT NULL DEFAULT '',
  from_line     TEXT NOT NULL DEFAULT '',            -- "From" on the envelope
  letter        JSONB NOT NULL DEFAULT '[]',         -- ["paragraph", ...]
  quick_facts   JSONB NOT NULL DEFAULT '[]',         -- [["Founded", "1559"], ...]
  sources       JSONB NOT NULL DEFAULT '[]',         -- [["label", "https://..."], ...]
  published     BOOLEAN NOT NULL DEFAULT TRUE,       -- false hides the whole city
  sort_order    INTEGER NOT NULL DEFAULT 0,
  updated_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The tabs inside a city's letter: Landmarks, Festivals & Arts, Food, Fun Facts.
CREATE TABLE sections (
  id         SERIAL PRIMARY KEY,
  city_id    TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  slug       TEXT NOT NULL,                          -- 'landmarks'
  label      TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (city_id, slug)
);

-- Every fact card. Only status = 'verified' is shown on the website.
-- 'needs_check' = written but not yet checked by a second person.
CREATE TABLE facts (
  id          SERIAL PRIMARY KEY,
  section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  source_url  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'needs_check' CHECK (status IN ('needs_check', 'verified')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,   -- NULL = imported from the old content.js
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ
);
CREATE INDEX facts_section ON facts (section_id);

-- Quiz questions follow the same check-before-showing rule. The answer never leaves the server
-- until someone has chosen an option.
CREATE TABLE quiz_questions (
  id           SERIAL PRIMARY KEY,
  city_id      TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  options      JSONB NOT NULL,                       -- ["option A", "option B", ...]
  answer_index INTEGER NOT NULL,                     -- position of the right option, from 0
  source_url   TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'needs_check' CHECK (status IN ('needs_check', 'verified')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at  TIMESTAMPTZ
);
CREATE INDEX quiz_questions_city ON quiz_questions (city_id);

-- Every change an editor makes, with the before and after, so nothing is lost and
-- the team can see who changed what.
CREATE TABLE content_log (
  id        SERIAL PRIMARY KEY,
  user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action    TEXT NOT NULL,                           -- create / update / verify / unverify / delete / role
  entity    TEXT NOT NULL,                           -- fact / quiz / city / user
  entity_id TEXT NOT NULL,
  before    JSONB,
  after     JSONB,
  at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX content_log_at ON content_log (at DESC);

-- ---------------------------------------------------------------- learning progress
-- Which sections of which city a learner has opened.
CREATE TABLE covered_sections (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section_id)
);

-- Points work like a bank statement: every award is one row, and a learner's total is the sum.
-- `ref` + `reason` is unique per user, so the same thing can never pay out twice.
CREATE TABLE points_ledger (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points  INTEGER NOT NULL,
  reason  TEXT NOT NULL,                             -- 'city_visit' / 'section_read' / 'quiz_best'
  ref     TEXT NOT NULL,                             -- what it was for, e.g. 'udaipur' or 'section:3'
  at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason, ref)
);
