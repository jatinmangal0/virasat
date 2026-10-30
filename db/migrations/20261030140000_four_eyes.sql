-- Version 6: closing the gaps in the four-eyes rule, found in the 30 October review.
-- Earlier migrations have already run on the live site; never edit them, add a new file instead.

-- ---------------------------------------------------------------- who wrote the words being checked
-- Before: only the person who made the LATEST change was blocked from verifying. So if Asha wrote a fact and
-- Neel then fixed a typo, Asha could verify her own words. Now each item keeps `authors`: everyone who has
-- written or changed its words since it was last verified. None of them may verify it. Verifying empties the
-- list; rewording a live item starts a new list with the person who reworded it.
ALTER TABLE facts           ADD COLUMN authors INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE quiz_questions  ADD COLUMN authors INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE timeline_events ADD COLUMN authors INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE greetings       ADD COLUMN authors INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE heritage_places ADD COLUMN authors INTEGER[] NOT NULL DEFAULT '{}';

-- Items waiting for a check: their creator and last editor count as authors (imported items have neither).
UPDATE facts           SET authors = ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[created_by, updated_by]) x WHERE x IS NOT NULL) WHERE status = 'needs_check';
UPDATE quiz_questions  SET authors = ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[created_by, updated_by]) x WHERE x IS NOT NULL) WHERE status = 'needs_check';
UPDATE timeline_events SET authors = ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[created_by, updated_by]) x WHERE x IS NOT NULL) WHERE status = 'needs_check';
UPDATE greetings       SET authors = ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[created_by, updated_by]) x WHERE x IS NOT NULL) WHERE status = 'needs_check';
UPDATE heritage_places SET authors = ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[created_by, updated_by]) x WHERE x IS NOT NULL) WHERE status = 'needs_check';

-- ---------------------------------------------------------------- the city letter gets checked too
-- Before: saving the letter put it straight on the website, with no second check (that is how "founded in 1559"
-- went live). Now a save is a draft; a different editor verifies it, and only then does it replace the live letter.
ALTER TABLE cities ADD COLUMN draft    JSONB;                                        -- the proposed letter, or NULL
ALTER TABLE cities ADD COLUMN draft_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cities ADD COLUMN draft_at TIMESTAMPTZ;

-- ---------------------------------------------------------------- quiz answers count the first try
-- /api/quiz/check tells a player the right answer after they choose, so the page can teach. Before, someone could
-- ask for every answer and then send a perfect score. Now each check by a logged-in player is recorded, and a
-- round is marked by the FIRST choice made on each question since that player's last round for the city.
CREATE TABLE quiz_checks (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  choice      INTEGER NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX quiz_checks_user ON quiz_checks (user_id, question_id, at);
ALTER TABLE quiz_results ADD COLUMN at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();
