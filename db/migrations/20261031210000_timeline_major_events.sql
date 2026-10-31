-- Jatin (31 Oct): the timeline shows only each city's major events. The other events are kept, verified and
-- editable, but hidden from the timeline (editors can show them again on the editor page).
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

UPDATE timeline_events SET hidden = true
WHERE (city_id = 'kolkata' AND year_label || ' ' || title NOT IN (
         '1690 A trading post on the Hooghly', '1757 The Battle of Plassey', '1905 Bengal is split',
         '1911 No longer the capital', '1913 A Nobel Prize for Tagore', '1943 Howrah Bridge opens',
         '1984 India''s first metro', '2001 Calcutta becomes Kolkata'))
   OR (city_id = 'udaipur' AND year_label || ' ' || title NOT IN (
         '1553 Udaipur is founded', '1559 Work begins on the City Palace', '1576 The Battle of Haldighati',
         '1615 Peace with the Mughals', '1746 The Lake Palace is finished', '1948 Udaipur joins Rajasthan'));
