-- Version 10: classes, for teachers who use Virasat with a class.
-- A teacher (any account) starts a class and gets a six-letter code. Students join with the code and a
-- nickname only: no email, no phone. India's data protection law treats everyone under 18 as a child, so the
-- class account collects nothing personal. The teacher sees who opened which city, their best Seal the letter
-- score and their passport stamps, and can set a city as homework with a date.
-- Earlier migrations have already run on the live site; never edit them, add a new file instead.
CREATE TABLE classes (
  id         SERIAL PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,                 -- e.g. 'K7Q2MX', no 0/O or 1/I to avoid mix-ups
  name       TEXT NOT NULL,                        -- e.g. 'Class 8B Social Science'
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE class_members (
  class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname   TEXT NOT NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id),
  UNIQUE (class_id, nickname)                      -- two students cannot share a name in one class
);

CREATE TABLE assignments (
  id        SERIAL PRIMARY KEY,
  class_id  INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  city      TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  due_on    DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, city)
);
