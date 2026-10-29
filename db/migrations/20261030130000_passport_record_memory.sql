-- Version 5: the Fading Passport, and "the record and the memory" on timeline events.
-- Earlier migrations have already run on the live site; never edit them, add a new file instead.

-- ---------------------------------------------------------------- the Fading Passport
-- A city's stamp is pressed into a learner's passport when they seal its letter (3 in 5 or better).
-- Then it fades: it is due for a short recall after 2 days, then 7, then 21. Each recall passed moves it up a
-- box and re-inks it; a recall failed sends it back to box 1. Box 4 means it is kept for good.
-- This is the Leitner system for spaced practice. The rules live in server/api/passport.js.
CREATE TABLE stamps (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city        TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  box         SMALLINT NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 4),
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at      TIMESTAMPTZ,                        -- when the next recall is due; NULL once kept for good (box 4)
  recalled_at TIMESTAMPTZ,                        -- the last recall, passed or not
  PRIMARY KEY (user_id, city)
);

-- ---------------------------------------------------------------- the record and the memory
-- Some events are told one way by the sources and remembered another way. When `memory` is filled in, the
-- timeline shows both side by side: the event text is the record, `memory` is how it is remembered, and
-- `argued` says in one line why people disagree. Each side has its own source. These are part of the
-- event's wording, so changing them sends the event back to be checked.
ALTER TABLE timeline_events ADD COLUMN memory TEXT NOT NULL DEFAULT '';
ALTER TABLE timeline_events ADD COLUMN memory_source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE timeline_events ADD COLUMN argued TEXT NOT NULL DEFAULT '';

-- Three to start, from the 30 October fact check. They stay drafts until a second teammate checks them.
WITH memories (city, title, memory, memory_src, argued) AS (VALUES
  ('udaipur', 'Udaipur is founded',
   'Many books and guides still give 1559 as the year Udaipur was founded.',
   'https://en.wikipedia.org/wiki/Udaipur',
   '1559 is when work began on the City Palace, the city''s best-known building, so the two dates are easy to mix up.'),
  ('udaipur', 'The Battle of Haldighati',
   'In Mewar, Pratap is remembered as the hero who never bowed to Akbar, and some retellings call Haldighati his victory.',
   'https://en.wikipedia.org/wiki/Battle_of_Haldighati',
   'The Mughals held the field, but Pratap was never captured and kept fighting; in 2017 a proposal to teach the battle as his win in Rajasthan''s schools drew criticism from historians.'),
  ('kolkata', 'A trading post on the Hooghly',
   'For a long time Job Charnock was called the founder of Calcutta, and 24 August 1690 was marked as the city''s birthday.',
   'https://en.wikipedia.org/wiki/Job_Charnock',
   'Kalikata and its neighbours were already villages before the Company arrived; in 2003 the Calcutta High Court ruled that Charnock should not be called the sole founder.')
), targets AS (
  SELECT e.id, to_jsonb(e) AS row, m.* FROM timeline_events e JOIN memories m ON m.city = e.city_id AND m.title = e.title
), done AS (
  UPDATE timeline_events e SET memory = t.memory, memory_source_url = t.memory_src, argued = t.argued,
    status = 'needs_check', verified_by = NULL, verified_at = NULL, updated_at = now()
  FROM targets t WHERE e.id = t.id RETURNING e.*
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'update', 'timeline', d.id::text, t.row, to_jsonb(d) FROM done d JOIN targets t ON t.id = d.id;
