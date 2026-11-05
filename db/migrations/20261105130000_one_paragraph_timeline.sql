-- Every timeline entry is one paragraph (Jatin, 5 Nov 2026). The three events that showed "The record" /
-- "The memory" boxes and a "Why it is argued about" line get their words merged into one paragraph, using
-- only the facts already on the page. The memory and argued columns are emptied; memory_source_url stays
-- and is now shown as the event's second source ("Sources: 1 · 2"), so no source link is dropped.
-- The wording was approved by Jatin in the project thread before this ran. The status is left as it was.
-- Each update only applies while the event still has exactly the old words, so a later edit is never overwritten.
WITH merged (city, title, old_body, old_memory, body) AS (VALUES
  ('kolkata', 'A trading post on the Hooghly',
   'The East India Company sets up a trading post among three villages, Sutanuti, Gobindapur and Kalikata. Kalikata was already a named village, mentioned in a poem of 1495, and in 2003 the Calcutta High Court ruled that Job Charnock should not be called the city''s sole founder.',
   'For a long time Job Charnock was called the founder of Calcutta, and 24 August 1690 was marked as the city''s birthday.',
   'In 1690 the East India Company set up a trading post among three villages on the Hooghly: Sutanuti, Gobindapur and Kalikata. For a long time Job Charnock was called the founder of Calcutta, and 24 August 1690 was marked as the city''s birthday. But Kalikata was already a named village, mentioned in a poem of 1495, and in 2003 the Calcutta High Court ruled that Charnock should not be called the city''s sole founder.'),
  ('udaipur', 'Udaipur is founded',
   'Maharana Udai Singh II founds a new capital for the Mewar kingdom in a bowl of the Aravalli hills, beside Lake Pichola.',
   'Many books and guides still give 1559 as the year Udaipur was founded.',
   'Maharana Udai Singh II founds a new capital for the Mewar kingdom in a bowl of the Aravalli hills, beside Lake Pichola. Many books and guides still give 1559 as the year Udaipur was founded, but 1559 is when work began on the City Palace, the city''s best-known building, so the two dates are easy to mix up.'),
  ('udaipur', 'The Battle of Haldighati',
   'In the hills north of the city, Maharana Pratap fights the Mughal army led by Man Singh. The Mughals win the day, but Pratap escapes and keeps fighting; Mewar remembers him as its greatest hero.',
   'In Mewar, Pratap is remembered as the hero who never bowed to Akbar, and some retellings call Haldighati his victory.',
   'In the hills north of the city, Maharana Pratap fights the Mughal army led by Man Singh. The Mughals win the day, but Pratap escapes, is never captured and keeps fighting. Mewar remembers him as its greatest hero, who never bowed to Akbar, and some retellings call Haldighati his victory; in 2017 a proposal to teach the battle as his win in Rajasthan''s schools drew criticism from historians.')
), targets AS (
  SELECT e.id, to_jsonb(e) AS row, m.body FROM timeline_events e
  JOIN merged m ON m.city = e.city_id AND m.title = e.title AND m.old_body = e.body AND m.old_memory = e.memory
), done AS (
  UPDATE timeline_events e SET body = t.body, memory = '', argued = '', updated_at = now()
  FROM targets t WHERE e.id = t.id RETURNING e.*
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'update', 'timeline', d.id::text, t.row, to_jsonb(d) FROM done d JOIN targets t ON t.id = d.id;
