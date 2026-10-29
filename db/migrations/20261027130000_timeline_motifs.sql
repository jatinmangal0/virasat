-- A small drawing for each timeline event, shown until the team adds real photos.
-- The names match server/public/js/motifs.js. Empty means "use the city's stamp".
ALTER TABLE timeline_events ADD COLUMN motif TEXT NOT NULL DEFAULT '';

UPDATE timeline_events SET motif = m.motif FROM (VALUES
  ('udaipur', '1559', 'city'), ('udaipur', '1576', 'battle'), ('udaipur', '1620s', 'island'), ('udaipur', '1678', 'lake'),
  ('udaipur', '1746', 'palace'), ('udaipur', '1884', 'clouds'), ('udaipur', '1983', 'film'),
  ('kolkata', '1690', 'ship'), ('kolkata', '1814', 'museum'), ('kolkata', '1855', 'temple'), ('kolkata', '1873', 'tram'),
  ('kolkata', '1911', 'crown'), ('kolkata', '1913', 'medal'), ('kolkata', '1943', 'bridge'), ('kolkata', '1984', 'metro'),
  ('kolkata', '2001', 'sign'), ('kolkata', '2021', 'drum')
) AS m(city_id, year_label, motif)
WHERE timeline_events.city_id = m.city_id AND timeline_events.year_label = m.year_label;
