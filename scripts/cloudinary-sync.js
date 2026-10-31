// Moves Virasat's images into Cloudinary and keeps only their links in the database.
//   CLOUDINARY_URL=... DATABASE_URL=... node scripts/cloudinary-sync.js
// Vercel runs it on production builds, after the migrations. Without CLOUDINARY_URL it does nothing.
//   1. The team's artwork for the cities (stamp, poster) is uploaded from server/public/assets, and
//      cities.stamp / cities.poster are set to the Cloudinary links.
//   2. Every photo that still points elsewhere (Wikimedia Commons links on facts, timeline events, the
//      letter's postcards and heritage places) is copied into Cloudinary, and the row points at the copy.
//      The original link is kept beside it (`original`, or details.image_original for places), and the
//      credit is unchanged. Each change is written to content_log.
// It is safe to run again: links already on Cloudinary are skipped, and the same photo always gets the
// same name in Cloudinary, so nothing is uploaded twice. A photo Cloudinary cannot fetch keeps its old link.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { makePool } from '../server/lib/db.js';
import { parseCloudinaryUrl, upload } from '../server/lib/cloudinary.js';

const assets = fileURLToPath(new URL('../server/public/', import.meta.url));
const onCloudinary = (u) => /^https:\/\/res\.cloudinary\.com\//.test(u || '');
const idFor = (url) => 'virasat/photos/' + createHash('sha1').update(url).digest('hex').slice(0, 20);

export async function sync(db, cfg, log = console.log) {
  const cache = new Map();
  let copied = 0, failed = 0;
  // one upload per distinct link, a few at a time
  const copy = async (url) => {
    if (!/^https:\/\//.test(url || '') || onCloudinary(url)) return null;
    if (!cache.has(url)) cache.set(url, upload(cfg, url, idFor(url)).then((u) => { copied++; return u; }, (e) => { failed++; log(`  could not copy ${url}: ${e.message}`); return null; }));
    return cache.get(url);
  };
  const logChange = (entity, id, before, after) => db.query(
    "INSERT INTO content_log (user_id, action, entity, entity_id, before, after) VALUES (NULL, 'update', $1, $2, $3, $4)",
    [entity, String(id), JSON.stringify({ ...before, note: 'image moved to Cloudinary' }), JSON.stringify(after)]);
  const inBatches = async (rows, fn) => { for (let i = 0; i < rows.length; i += 6) await Promise.all(rows.slice(i, i + 6).map(fn)); };

  // 1. city artwork, from our own files
  for (const c of (await db.query('SELECT id, stamp, poster FROM cities')).rows) {
    const next = {};
    for (const col of ['stamp', 'poster']) {
      const v = c[col];
      if (!v || onCloudinary(v) || !v.startsWith('assets/')) continue;
      const file = readFileSync(assets + v);
      const type = v.endsWith('.webp') ? 'image/webp' : v.endsWith('.png') ? 'image/png' : 'image/jpeg';
      next[col] = await upload(cfg, `data:${type};base64,${file.toString('base64')}`, 'virasat/site/' + v.replace(/^assets\//, '').replace(/\.\w+$/, ''));
    }
    if (Object.keys(next).length) {
      await db.query('UPDATE cities SET stamp = COALESCE($2, stamp), poster = COALESCE($3, poster) WHERE id = $1', [c.id, next.stamp || null, next.poster || null]);
      await logChange('city', c.id, { stamp: c.stamp, poster: c.poster }, next);
      log(`  ${c.id}: artwork on Cloudinary`);
    }
  }

  // 2. photos stored as links
  await inBatches((await db.query('SELECT id, image FROM facts WHERE image IS NOT NULL')).rows, async (f) => {
    const u = await copy(f.image.src);
    if (!u) return;
    const image = { ...f.image, src: u, original: f.image.src };
    await db.query('UPDATE facts SET image = $2 WHERE id = $1', [f.id, JSON.stringify(image)]);
    await logChange('fact', f.id, { image: f.image }, { image });
  });
  await inBatches((await db.query("SELECT id, images FROM timeline_events WHERE jsonb_array_length(images) > 0")).rows, async (e) => {
    const images = await Promise.all(e.images.map(async (im) => { const u = await copy(im.src); return u ? { ...im, src: u, original: im.src } : im; }));
    if (JSON.stringify(images) === JSON.stringify(e.images)) return;
    await db.query('UPDATE timeline_events SET images = $2 WHERE id = $1', [e.id, JSON.stringify(images)]);
    await logChange('timeline', e.id, { images: e.images }, { images });
  });
  await inBatches((await db.query("SELECT id, photos FROM cities WHERE photos IS NOT NULL AND jsonb_typeof(photos) = 'array'")).rows, async (c) => {
    const photos = await Promise.all(c.photos.map(async (ph) => { const u = await copy(ph.src); return u ? { ...ph, src: u, original: ph.src } : ph; }));
    if (JSON.stringify(photos) === JSON.stringify(c.photos)) return;
    await db.query('UPDATE cities SET photos = $2 WHERE id = $1', [c.id, JSON.stringify(photos)]);
    await logChange('city', c.id, { photos: c.photos }, { photos });
  });
  await inBatches((await db.query("SELECT id, image_url, details FROM heritage_places WHERE image_url LIKE 'https://%'")).rows, async (p) => {
    const u = await copy(p.image_url);
    if (!u) return;
    await db.query("UPDATE heritage_places SET image_url = $2, details = COALESCE(details, '{}'::jsonb) || jsonb_build_object('image_original', $3::text) WHERE id = $1", [p.id, u, p.image_url]);
    await logChange('place', p.id, { image_url: p.image_url }, { image_url: u });
  });
  log(`Cloudinary: ${copied} photos copied, ${failed} could not be copied.`);
  return { copied, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cfg = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  if (!cfg) { console.log('No CLOUDINARY_URL: images stay where they are.'); process.exit(0); }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') { console.log(`Skipping the Cloudinary sync on a ${process.env.VERCEL_ENV} build.`); process.exit(0); }
  const db = makePool();
  // never stops a deploy: whatever could not be moved simply keeps its old link until the next build
  try { await sync(db, cfg); } catch (e) { console.log(`Cloudinary sync stopped: ${e.message}`); } finally { await db.end(); }
}
