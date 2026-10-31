-- The team's artwork for the cities (31 Oct 2026): Kolkata's stamp and both cities' posters above the letter.
-- cities.stamp and cities.poster pointed at old images that were deleted; they now hold the new files' links.
-- The build's Cloudinary sync (scripts/cloudinary-sync.js) later swaps these for Cloudinary links.
-- Udaipur has no stamp artwork yet, so it keeps the stamp drawn in code (stamp is empty).
UPDATE cities SET stamp = 'assets/stamp-kolkata.webp', poster = 'assets/letter-kolkata.webp' WHERE id = 'kolkata';
UPDATE cities SET stamp = '', poster = 'assets/letter-udaipur.webp' WHERE id = 'udaipur';
