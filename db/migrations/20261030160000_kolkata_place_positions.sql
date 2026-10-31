-- Version 8: map positions for Kolkata places that had none, so they can appear on the map once checked.
-- 33 places (all 14 food places, Kumartuli and the craft quarters among them) had no latitude and longitude, so the
-- map dropped them. These 20 were found by name on OpenStreetMap or on their Wikipedia page; branches and lookalikes
-- were left out (Flurys, Mitra Cafe, Paramount, the Bengal Club and Balaram Mullick still need a position by hand).
-- coord_method says where each position came from. Positions are part of a place's wording, so each one goes back
-- to "needs check": a teammate confirms it on the map before it goes live.
-- Earlier migrations have already run on the live site; never edit them, add a new file instead.
WITH found (name, lat, lng, how) AS (VALUES
  ('A.J.C. Bose Indian Botanic Garden', 22.5582, 88.28923, 'OpenStreetMap way/52097541 (looked up 2026-10-30; check on the map)'),
  ('Aminia', 22.56246, 88.35261, 'Wikipedia: Aminia (looked up 2026-10-30; check on the map)'),
  ('Bowbazar', 22.57049, 88.36156, 'OpenStreetMap node/1190128273 (looked up 2026-10-30; check on the map)'),
  ('Chitpur (Attar)', 22.60683, 88.36746, 'OpenStreetMap way/34995994 (looked up 2026-10-30; check on the map)'),
  ('Chitpur (Jatra)', 22.60683, 88.36746, 'OpenStreetMap way/34995994 (looked up 2026-10-30; check on the map)'),
  ('East Bengal FC', 22.55898, 88.3438, 'OpenStreetMap way/623549475 (looked up 2026-10-30; check on the map)'),
  ('Holy Rosary (Portuguese) Church', 22.57864, 88.35276, 'OpenStreetMap node/4209577082 (looked up 2026-10-30; check on the map)'),
  ('Indian Coffee House', 22.5761, 88.36389, 'OpenStreetMap node/4571180589 (looked up 2026-10-30; check on the map)'),
  ('K.C. Das', 22.56547, 88.35151, 'OpenStreetMap node/4825578822 (looked up 2026-10-30; check on the map)'),
  ('Kumartuli', 22.6, 88.3614, 'Wikipedia: Kumortuli (looked up 2026-10-30; check on the map)'),
  ('Metiabruz', 22.54357, 88.26793, 'OpenStreetMap node/10692982851 (looked up 2026-10-30; check on the map)'),
  ('Missionaries of Charity Mother House', 22.55309, 88.36363, 'OpenStreetMap way/287111387 (looked up 2026-10-30; check on the map)'),
  ('Mocambo', 22.55325, 88.35053, 'Wikipedia: Mocambo (restaurant) (looked up 2026-10-30; check on the map)'),
  ('Mohammedan Sporting Club', 22.56237, 88.34586, 'OpenStreetMap way/102784456 (looked up 2026-10-30; check on the map)'),
  ('Mohun Bagan AC', 22.56166, 88.34219, 'OpenStreetMap way/657521034 (looked up 2026-10-30; check on the map)'),
  ('Nizam''s', 22.56214, 88.35354, 'OpenStreetMap node/5150935621 (looked up 2026-10-30; check on the map)'),
  ('Pareshnath Jain Temple (Belgachia)', 22.59162, 88.37784, 'Wikipedia: Calcutta Jain Temple (looked up 2026-10-30; check on the map)'),
  ('Peter Cat', 22.55245, 88.35262, 'OpenStreetMap node/3565448998 (looked up 2026-10-30; check on the map)'),
  ('Tangra Tanneries', 22.55651, 88.37959, 'OpenStreetMap node/1283776497 (looked up 2026-10-30; check on the map)'),
  ('Tiretta Bazaar Morning Market', 22.57482, 88.35631, 'OpenStreetMap node/9191667611 (looked up 2026-10-30; check on the map)')
), before AS (
  SELECT p.id, to_jsonb(p) AS row, f.* FROM heritage_places p JOIN found f ON f.name = p.name
  WHERE p.city_id = 'kolkata' AND (p.latitude IS NULL OR p.longitude IS NULL)
), done AS (
  UPDATE heritage_places p SET latitude = b.lat, longitude = b.lng, coord_method = b.how,
    status = 'needs_check', verified_by = NULL, verified_at = NULL
  FROM before b WHERE p.id = b.id RETURNING p.*
)
INSERT INTO content_log (user_id, action, entity, entity_id, before, after)
SELECT NULL, 'update', 'place', d.id::text, b.row, to_jsonb(d) FROM done d JOIN before b ON b.id = d.id;
