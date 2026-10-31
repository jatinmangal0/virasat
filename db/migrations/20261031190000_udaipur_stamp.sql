-- Jatin's Udaipur stamp artwork (31 Oct). The deploy's Cloudinary sync then uploads it and swaps in the link.
-- Only fills an empty stamp, so an editor's later choice is never overwritten.
UPDATE cities SET stamp = 'assets/stamp-udaipur.webp' WHERE id = 'udaipur' AND stamp = '';
