-- Version 11: the history the timelines left out, two Kolkata women, a Kolkata letter draft, and greeting fixes.
-- Everything here is a DRAFT: it reaches the website only after a second teammate checks it on the editor page.
-- Each date and claim was read in its source on 30 October 2026.
-- Earlier migrations have already run on the live site; never edit them, add a new file instead.

-- ---------------------------------------------------------------- the timelines, filled in
-- Places on the thread (sort_order) are by year; existing events keep their order between these.
WITH ev (city, year_label, title, body, src, motif, ord) AS (VALUES
  ('udaipur', 'c. 1536', 'Panna Dhai saves a prince',
   'When his uncle Banvir comes to kill the young Udai Singh, his nursemaid Panna Dhai hides him and gives up her own son, Chandan, in his place. The boy she saved would found Udaipur.',
   'https://en.wikipedia.org/wiki/Panna_Dai', 'crown', -2),
  ('udaipur', '1568', 'Chittor falls',
   'After a siege of four months, Akbar''s army takes the great fort of Chittor, Mewar''s old capital. Udai Singh II had already moved into the hills, and Udaipur becomes the kingdom''s capital.',
   'https://en.wikipedia.org/wiki/Siege_of_Chittorgarh_(1567%E2%80%931568)', 'battle', 15),
  ('udaipur', '1615', 'Peace with the Mughals',
   'After years of war, Maharana Amar Singh I, Pratap''s son, makes peace with the emperor Jahangir. Prince Khurram, the future Shah Jahan, negotiates it.',
   'https://en.wikipedia.org/wiki/Amar_Singh_I', 'crown', 25),
  ('udaipur', '1818', 'A treaty with the Company',
   'Plundered by Maratha armies, Mewar signs a treaty with the East India Company on 13 January 1818 and becomes a princely state under British protection.',
   'https://en.wikipedia.org/wiki/Kingdom_of_Mewar', 'sign', 55),
  ('udaipur', '1948', 'Udaipur joins Rajasthan',
   'After independence Maharana Bhupal Singh signs Mewar into India, and on 18 April 1948 he becomes Rajpramukh, the head, of the new state of Rajasthan.',
   'https://en.wikipedia.org/wiki/Bhupal_Singh', 'city', 75),
  ('kolkata', '1756', 'The Nawab takes Calcutta',
   'Angered by new fortifications at Fort William, Siraj-ud-Daulah, the Nawab of Bengal, captures Calcutta on 20 June 1756.',
   'https://en.wikipedia.org/wiki/Siege_of_Calcutta', 'battle', 5),
  ('kolkata', '1757', 'The Battle of Plassey',
   'Helped by the betrayal of Mir Jafar, Robert Clive''s East India Company army defeats the Nawab on 23 June 1757. From Calcutta, Company rule over Bengal begins.',
   'https://en.wikipedia.org/wiki/Battle_of_Plassey', 'battle', 6),
  ('kolkata', '1770', 'The great famine',
   'Famine strikes Bengal and Bihar in 1769 and 1770, while the Company collects the land revenue. It affects some 30 million people, about a third of the region.',
   'https://en.wikipedia.org/wiki/Great_Bengal_famine_of_1770', '', 7),
  ('kolkata', '1784', 'The Asiatic Society',
   'William Jones founds the Asiatic Society in Calcutta on 15 January 1784, to study the languages, history and sciences of India and Asia.',
   'https://en.wikipedia.org/wiki/The_Asiatic_Society', 'museum', 8),
  ('kolkata', '1817', 'Hindu College opens',
   'Hindu College opens in 1817. Renamed Presidency College in 1855 and now Presidency University on College Street, it helped start the Bengal Renaissance.',
   'https://en.wikipedia.org/wiki/Presidency_University,_Kolkata', 'medal', 12),
  ('kolkata', '1856', 'Widows may remarry',
   'After a long campaign by the Calcutta scholar Ishwar Chandra Vidyasagar, a new law lets Hindu widows marry again.',
   'https://en.wikipedia.org/wiki/Ishwar_Chandra_Vidyasagar', 'sign', 22),
  ('kolkata', '1905', 'Bengal is split',
   'Lord Curzon divides Bengal on 16 October 1905. Protests spread from Calcutta, and the partition is undone six years later.',
   'https://en.wikipedia.org/wiki/Partition_of_Bengal_(1905)', 'sign', 35),
  ('kolkata', '1943', 'The Bengal famine',
   'In the year Howrah Bridge opens, famine kills an estimated 800,000 to 3.8 million people across Bengal, made worse by wartime British policies.',
   'https://en.wikipedia.org/wiki/Bengal_famine_of_1943', '', 61)
), done AS (
  INSERT INTO timeline_events (city_id, year_label, title, body, source_url, motif, sort_order)
  SELECT city, year_label, title, body, src, motif, ord FROM ev
  WHERE NOT EXISTS (SELECT 1 FROM timeline_events t WHERE t.city_id = ev.city AND t.title = ev.title)
  RETURNING *
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'create', 'timeline', d.id::text, NULL, to_jsonb(d) FROM done d;

-- Space the old events out by year so the new ones fall in between (the existing ones were numbered 0, 1, 2...).
UPDATE timeline_events t SET sort_order = x.ord FROM (VALUES
  ('udaipur', '1553', 0), ('udaipur', '1559', 10), ('udaipur', '1576', 20), ('udaipur', '1620s', 30), ('udaipur', '1678', 40),
  ('udaipur', '1746', 50), ('udaipur', '1884', 60), ('udaipur', '1983', 80),
  ('kolkata', '1690', 0), ('kolkata', '1814', 10), ('kolkata', '1855', 20), ('kolkata', '1873', 30), ('kolkata', '1911', 40),
  ('kolkata', '1913', 50), ('kolkata', '1943', 60), ('kolkata', '1984', 70), ('kolkata', '2001', 80), ('kolkata', '2021', 90)
) AS x(city, year_label, ord)
WHERE t.city_id = x.city AND t.year_label = x.year_label AND t.created_by IS NULL AND t.title NOT IN ('The Bengal famine');

-- ---------------------------------------------------------------- two Kolkata women, as fact cards
WITH f (title, body, src) AS (VALUES
  ('Kadambini Ganguly',
   'In 1886 Kadambini Ganguly of Calcutta and Anandibai Joshi became the first Indian women to qualify as doctors in Western medicine. Kadambini was India''s first practising woman doctor.',
   'https://en.wikipedia.org/wiki/Kadambini_Ganguly'),
  ('Begum Rokeya',
   'The writer and educator Begum Rokeya wrote Sultana''s Dream, an early feminist story imagining a land run by women, and argued that girls must be educated as boys are.',
   'https://en.wikipedia.org/wiki/Begum_Rokeya')
), done AS (
  INSERT INTO facts (section_id, title, body, source_url, sort_order)
  SELECT (SELECT id FROM sections WHERE city_id = 'kolkata' AND slug = 'facts'), title, body, src, 20 FROM f
  WHERE NOT EXISTS (SELECT 1 FROM facts x JOIN sections s ON s.id = x.section_id WHERE s.city_id = 'kolkata' AND x.title = f.title)
  RETURNING *
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'create', 'fact', d.id::text, NULL, to_jsonb(d) FROM done d;

-- Laal maas is from the western desert (Mathania chillies, near Jodhpur), not a Mewar dish.
UPDATE facts f SET body = 'A fiery mutton curry, red from Mathania chillies grown near Jodhpur. A Rajput dish, it is loved across Rajasthan.',
  source_url = 'https://en.wikipedia.org/wiki/Laal_maas', updated_at = now()
FROM sections s WHERE s.id = f.section_id AND s.city_id = 'udaipur' AND f.title = 'Laal Maas' AND f.status = 'needs_check';

-- ---------------------------------------------------------------- a Kolkata letter draft
-- "The City of Joy" comes from a 1985 novel about a slum, and every quick fact was colonial. This draft leads with
-- the river and the city's own culture. It goes live only when a teammate verifies it (City letter tab).
UPDATE cities SET draft = jsonb_build_object(
  'name', name, 'native_name', native_name, 'state', state, 'nickname', 'On the Hooghly',
  'greeting', greeting, 'greeting_note', greeting_note, 'from_line', from_line,
  'letter', '["Kolkata stands on the east bank of the Hooghly river, a branch of the Ganga. It grew from three villages, Sutanuti, Gobindapur and Kalikata, where the East India Company set up a trading post in 1690.","It was the capital of British India until 1911 and the heart of the Bengal Renaissance, a burst of new ideas in literature, science and social reform. Every autumn the whole city turns out for Durga Puja, on UNESCO''s list of the world''s living heritage since 2021."]'::jsonb,
  'quick_facts', '[["River","Hooghly, a branch of the Ganga"],["Durga Puja","UNESCO list, 2021"],["First metro in India","1984"],["Language","Bengali"]]'::jsonb,
  'sources', '[["Kolkata (Incredible India)","https://www.incredibleindia.gov.in/en/west-bengal/kolkata"],["Durga Puja in Kolkata (UNESCO)","https://ich.unesco.org/en/RL/durga-puja-in-kolkata-01703"],["Kolkata Metro","https://en.wikipedia.org/wiki/Kolkata_Metro"],["The three villages and 1690","https://en.wikipedia.org/wiki/Kalikata"]]'::jsonb),
  draft_by = NULL, draft_at = now()
WHERE id = 'kolkata' AND draft IS NULL;

-- ---------------------------------------------------------------- greetings
UPDATE greetings SET language = 'Bhutia (Sikkim)', source_url = 'https://en.wikipedia.org/wiki/Tashi_delek' WHERE word = 'Tashi Delek' AND language = 'Sikkimese';
UPDATE greetings SET source_url = 'https://en.wiktionary.org/wiki/%E0%AC%A8%E0%AC%AE%E0%AC%B8%E0%AD%8D%E0%AC%95%E0%AC%BE%E0%AC%B0' WHERE word = 'Namaskar' AND language = 'Odia' AND source_url = '';
INSERT INTO greetings (word, native, language, source_url, sort_order)
SELECT * FROM (VALUES ('Khublei', '', 'Khasi', 'https://en.wiktionary.org/wiki/khublei', 15), ('Chibai', '', 'Mizo', 'https://en.wiktionary.org/wiki/chibai', 16)) AS g(word, native, language, src, ord)
WHERE NOT EXISTS (SELECT 1 FROM greetings x WHERE x.word = g.word);
