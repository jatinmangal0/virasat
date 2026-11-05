// Replacing a photo on the editor page: only that photo changes, its credit is required, and a live item
// goes back to be checked by someone other than the person who swapped the photo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t, asha, neel, learner;
before(async () => {
  t = await startServer();
  asha = await t.person('Asha', 'editor');
  neel = await t.person('Neel', 'editor');
  learner = await t.person('Learner');
});
after(() => t.stop());

const NEW = { src: 'https://res.cloudinary.com/demo/image/upload/v1/virasat/uploads/new.jpg', credit: 'Asha for Virasat, CC BY 4.0', caption: 'The new view' };

test('a fact photo is replaced, its words stay, and a live fact needs a new check', async () => {
  const f = (await t.db.query("SELECT * FROM facts WHERE image IS NOT NULL ORDER BY id LIMIT 1")).rows[0];
  await t.db.query("UPDATE facts SET status = 'verified', authors = '{}' WHERE id = $1", [f.id]);
  assert.equal((await learner(`/api/admin/facts/${f.id}/photo/0`, NEW, 'PUT')).status, 403);
  assert.equal((await asha(`/api/admin/facts/${f.id}/photo/0`, { ...NEW, credit: '' }, 'PUT')).status, 400, 'a credit is required');
  assert.equal((await asha(`/api/admin/facts/${f.id}/photo/0`, { ...NEW, src: 'http://x.org/a.jpg' }, 'PUT')).status, 400, 'https only');
  assert.equal((await asha(`/api/admin/facts/${f.id}/photo/1`, NEW, 'PUT')).status, 400, 'a fact has one photo');
  assert.equal((await asha(`/api/admin/facts/${f.id}/photo/0`, { ...NEW, updatedAt: '2001-01-01T00:00:00Z' }, 'PUT')).status, 409, 'an old copy is refused');

  const r = await asha(`/api/admin/facts/${f.id}/photo/0`, { ...NEW, page: 'https://example.com/new', updatedAt: f.updated_at }, 'PUT');
  assert.equal(r.status, 200);
  assert.equal(r.body.backToCheck, true);
  assert.deepEqual(r.body.fact.image, { src: NEW.src, page: 'https://example.com/new', credit: NEW.credit, caption: NEW.caption });
  assert.equal(r.body.fact.title, f.title);
  assert.equal(r.body.fact.body, f.body);
  assert.equal(r.body.fact.status, 'needs_check');
  assert.equal((await asha(`/api/admin/facts/${f.id}/verify`, {})).status, 403, 'the person who swapped it cannot verify it');
  assert.equal((await neel(`/api/admin/facts/${f.id}/verify`, {})).status, 200);
  const log = (await t.db.query("SELECT * FROM content_log WHERE entity = 'fact' AND entity_id = $1 AND action = 'update'", [String(f.id)])).rows;
  assert.equal(log.at(-1).before.image.src, f.image.src, 'History keeps the old photo');
});

test('one timeline photo is replaced and the credit goes into its caption; the others stay', async () => {
  const images = [{ src: 'https://example.com/a.jpg', caption: 'First. Photo: A, CC0', original: 'https://commons.wikimedia.org/a' }, { src: 'https://example.com/b.jpg', caption: 'Second. Photo: B, CC0' }];
  const e = (await t.db.query("UPDATE timeline_events SET images = $1 WHERE id = (SELECT MIN(id) FROM timeline_events) RETURNING *", [JSON.stringify(images)])).rows[0];
  const r = await asha(`/api/admin/timeline/${e.id}/photo/1`, { src: NEW.src, caption: 'The new view.', credit: NEW.credit }, 'PUT');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.timeline.images, [images[0], { src: NEW.src, caption: `The new view. Photo: ${NEW.credit}` }]);
  assert.equal(r.body.timeline.title, e.title);
  const add = await asha(`/api/admin/timeline/${e.id}/photo/2`, NEW, 'PUT');
  assert.equal(add.body.timeline.images.length, 3, 'a photo can be added where there is room');
  assert.equal((await asha(`/api/admin/timeline/${e.id}/photo/5`, NEW, 'PUT')).status, 400);
});

test('a place photo is replaced, and the old page link never stays with the new photo', async () => {
  const p = (await t.db.query(`UPDATE heritage_places SET image_url = 'https://res.cloudinary.com/demo/image/upload/old.jpg',
    details = COALESCE(details, '{}'::jsonb) || '{"image_original": "https://commons.wikimedia.org/wiki/Special:FilePath/Old.jpg", "notes": "keep"}'::jsonb
    WHERE id = (SELECT MIN(id) FROM heritage_places) RETURNING *`)).rows[0];
  let r = await asha(`/api/admin/places/${p.id}/photo/0`, { src: NEW.src, credit: NEW.credit }, 'PUT');
  assert.equal(r.status, 200);
  assert.equal(r.body.place.image_url, NEW.src);
  assert.equal(r.body.place.image_license, NEW.credit);
  assert.equal(r.body.place.details.image_original, undefined);
  assert.equal(r.body.place.details.notes, 'keep', "Aksh's other research columns stay");
  r = await asha(`/api/admin/places/${p.id}/photo/0`, { src: NEW.src, credit: NEW.credit, page: 'https://example.com/page' }, 'PUT');
  assert.equal(r.body.place.details.image_original, 'https://example.com/page');
  const pub = await t.client()(`/api/cities/${p.city_id}/places`);
  assert.equal(pub.status, 200);
});

test('other kinds have no photo route', async () => {
  assert.equal((await asha('/api/admin/quiz/1/photo/0', NEW, 'PUT')).status, 404);
});
