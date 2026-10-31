-- Version 4: corrections from the fact check of 30 October 2026, and places sent back for checking.
-- Earlier migrations have already run on the live site; never edit them, add a new file instead.
--
-- Every change below is written to content_log (user_id NULL = made by a migration), so the
-- History tab on the editor page shows it. Nothing here marks anything as verified: only a
-- second person on the editor page can do that.

-- ---------------------------------------------------------------- Udaipur was founded in 1553
-- Eternal Mewar: "in 1553 CE, on the day of Akshaya Tritiya … Udaipur was established" and
-- "in 1559 CE, Maharana started the construction of the Palace". The city letter goes live
-- without a verify step, so this is the most visible fix.
WITH before AS (SELECT to_jsonb(c) AS row FROM cities c WHERE id = 'udaipur'), done AS (
  UPDATE cities SET
    letter = jsonb_set(letter, '{0}', to_jsonb('Udaipur sits in a bowl of the Aravalli hills in southern Rajasthan. Maharana Udai Singh II founded it in 1553 as the new capital of the Mewar kingdom, ruled by the Sisodia Rajputs, and in 1559 he began building his great palace there.'::text)),
    quick_facts = '[["Founded","1553"],["Founder","Maharana Udai Singh II"],["Kingdom","Mewar"],["Language","Mewari, Hindi"]]'::jsonb,
    sources = '[["Udaipur''s founding (Eternal Mewar)","https://www.eternalmewar.in/capitals"],["Udaipur (Rajasthan Tourism)","https://www.tourism.rajasthan.gov.in/content/rajasthan-tourism/en/tourist-destinations/udaipur.html"],["Sisodia dynasty","https://en.wikipedia.org/wiki/Sisodia_dynasty"],["Mewari language","https://en.wikipedia.org/wiki/Mewari_language"],["Khamma Ghani greeting","https://avtans.com/2026/03/17/khamma-ghani-origins-and-significance-explored/"]]'::jsonb,
    updated_at = now()
  WHERE id = 'udaipur' RETURNING *
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'update', 'city', 'udaipur', b.row, to_jsonb(d) FROM done d, before b;

-- The quiz question no longer carries the year in its wording.
WITH before AS (SELECT id, to_jsonb(q) AS row FROM quiz_questions q WHERE city_id = 'udaipur' AND question = 'Who founded Udaipur in 1559?'),
done AS (
  UPDATE quiz_questions q SET question = 'Who founded Udaipur as the new capital of Mewar?', source_url = 'https://www.eternalmewar.in/capitals',
    status = 'needs_check', updated_at = now()
  FROM before b WHERE q.id = b.id RETURNING q.*
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'update', 'quiz', d.id::text, b.row, to_jsonb(d) FROM done d JOIN before b ON b.id = d.id;

-- The timeline gets two events: the founding in 1553, and the palace begun in 1559.
WITH before AS (SELECT id, to_jsonb(e) AS row FROM timeline_events e WHERE city_id = 'udaipur' AND year_label = '1559' AND title = 'Udaipur is founded'),
done AS (
  UPDATE timeline_events e SET year_label = '1553',
    body = 'Maharana Udai Singh II founds a new capital for the Mewar kingdom in a bowl of the Aravalli hills, beside Lake Pichola.',
    source_url = 'https://www.eternalmewar.in/capitals', status = 'needs_check', updated_at = now()
  FROM before b WHERE e.id = b.id RETURNING e.*
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'update', 'timeline', d.id::text, b.row, to_jsonb(d) FROM done d JOIN before b ON b.id = d.id;

UPDATE timeline_events SET sort_order = sort_order + 1 WHERE city_id = 'udaipur' AND year_label <> '1553';
WITH done AS (
  INSERT INTO timeline_events (city_id, year_label, title, body, source_url, motif, sort_order) VALUES
    ('udaipur', '1559', 'Work begins on the City Palace',
     'Six years after founding the city, Udai Singh II starts the palace on the east bank of Lake Pichola. Later Maharanas keep adding to it for about 400 years.',
     'https://www.eternalmewar.in/capitals', 'palace', 1)
  RETURNING *
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'create', 'timeline', d.id::text, NULL, to_jsonb(d) FROM done d;

-- ---------------------------------------------------------------- other corrections (all still drafts)
-- Each row: how to find the item, the new text, and the new source ('' keeps the old one).
-- Sources for each: the fact-check table in the 30 October review.
WITH fixes (kind, city, find, new_body, new_src) AS (VALUES
  -- Begun in 1884, finished by his successor (Wikipedia, Monsoon Palace)
  ('fact', 'udaipur', 'Sajjangarh (Monsoon Palace)',
   'Begun in 1884 by Maharana Sajjan Singh on a hilltop west of the city. It was first planned as an observatory for watching monsoon clouds; he died before it was finished, and Maharana Fateh Singh completed it.', ''),
  -- The outcome was missing (Wikipedia: "Mughal victory"; Incredible India: "his forces could not claim victory")
  ('fact', 'udaipur', 'Maharana Pratap',
   'Mewar''s most famous ruler fought the Mughal army led by Man Singh at the Battle of Haldighati in 1576, in the Aravalli hills north of Udaipur. The Mughals won the day, but Pratap escaped and fought on for the rest of his life.',
   'https://www.incredibleindia.gov.in/en/rajasthan/udaipur/haldighati'),
  -- utsav.gov.in no longer loads; the fireworks detail had no source
  ('fact', 'udaipur', 'Mewar Festival',
   'Held in spring during Gangaur. Women carry idols of the goddess Gauri in a procession to Gangaur Ghat on Lake Pichola, with music and dance.',
   'https://www.incredibleindia.gov.in/en/festivals-and-events/rajasthan/mewar-festival-2026'),
  -- the MAP Academy link now redirects to a home page
  ('fact', 'udaipur', 'Mewar miniature painting',
   'A tradition of small, richly detailed paintings of court life, royal hunts and festivals, made with very fine brushes and natural colours.',
   'https://www.citypalacemuseum.org/galleries'),
  -- 2021 was cancelled (Wikipedia, International Kolkata Book Fair)
  ('fact', 'kolkata', 'International Kolkata Book Fair',
   'Started in 1976 and held almost every year, usually in winter, it is one of the biggest book fairs in the world by number of visitors.', ''),
  -- both states hold a GI tag (Wikipedia, Rasgulla)
  ('fact', 'kolkata', 'Rosogolla',
   'Soft cheese balls in sugar syrup. In 2017 West Bengal received a GI tag for "Banglar Rosogolla"; in 2019 Odisha received one for "Odisha Rasagola", and both states claim the sweet.',
   'https://en.wikipedia.org/wiki/Rasgulla')
), targets AS (
  SELECT f.id, to_jsonb(f) AS row, x.new_body, x.new_src FROM facts f
  JOIN sections s ON s.id = f.section_id JOIN fixes x ON x.city = s.city_id AND x.find = f.title
), done AS (
  UPDATE facts f SET body = t.new_body, source_url = COALESCE(NULLIF(t.new_src, ''), f.source_url),
    status = 'needs_check', updated_at = now()
  FROM targets t WHERE f.id = t.id RETURNING f.*
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'update', 'fact', d.id::text, t.row, to_jsonb(d) FROM done d JOIN targets t ON t.id = d.id;

WITH fixes (kind, city, find, new_body, new_src) AS (VALUES
  ('timeline', 'udaipur', 'The Battle of Haldighati',
   'In the hills north of the city, Maharana Pratap fights the Mughal army led by Man Singh. The Mughals win the day, but Pratap escapes and keeps fighting; Mewar remembers him as its greatest hero.', ''),
  ('timeline', 'udaipur', 'The Monsoon Palace',
   'Maharana Sajjan Singh begins Sajjangarh on a hilltop west of the city, first planned as an observatory for watching monsoon clouds. He dies that same year, and Maharana Fateh Singh finishes it.', ''),
  -- Kalikata is named in 1495; the Calcutta High Court ruled in 2003 that Charnock is not the sole founder
  ('timeline', 'kolkata', 'A trading post on the Hooghly',
   'The East India Company sets up a trading post among three villages, Sutanuti, Gobindapur and Kalikata. Kalikata was already a named village, mentioned in a poem of 1495, and in 2003 the Calcutta High Court ruled that Job Charnock should not be called the city''s sole founder.',
   'https://en.wikipedia.org/wiki/Job_Charnock'),
  -- the move was announced at the Delhi Durbar of 12 December 1911
  ('timeline', 'kolkata', 'No longer the capital',
   'At the Delhi Durbar, King George V announces that the capital of British India will move from Calcutta to Delhi.',
   'https://en.wikipedia.org/wiki/Delhi_Durbar')
), targets AS (
  SELECT e.id, to_jsonb(e) AS row, x.new_body, x.new_src FROM timeline_events e
  JOIN fixes x ON x.city = e.city_id AND x.find = e.title
), done AS (
  UPDATE timeline_events e SET body = t.new_body, source_url = COALESCE(NULLIF(t.new_src, ''), e.source_url),
    status = 'needs_check', updated_at = now()
  FROM targets t WHERE e.id = t.id RETURNING e.*
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'update', 'timeline', d.id::text, t.row, to_jsonb(d) FROM done d JOIN targets t ON t.id = d.id;

-- ---------------------------------------------------------------- places back to "needs check"
-- 20261027110100 made every imported place live without the second check. Places with no source,
-- or whose text still holds a research note such as "(verify year)", go back to needs_check: the
-- public map hides them and the editor page lists them to check.
WITH before AS (
  SELECT id, to_jsonb(p) AS row FROM heritage_places p
  WHERE status = 'verified' AND (source_url = '' OR description ~* 'verify|review notes')
), done AS (
  UPDATE heritage_places p SET status = 'needs_check', verified_at = NULL, verified_by = NULL
  FROM before b WHERE p.id = b.id RETURNING p.*
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'unverify', 'place', d.id::text, b.row, to_jsonb(d) FROM done d JOIN before b ON b.id = d.id;
