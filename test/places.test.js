// Aksh's heritage places: imported already checked (live), and back under the four-eyes rule once anyone edits one.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t, learner, asha, neel;
before(async () => {
  t = await startServer();
  learner = await t.person('Learner');
  asha = await t.person('Asha', 'editor');
  neel = await t.person('Neel', 'editor');
});
after(() => t.stop());

const publicNames = async (city) => (await t.client()(`/api/cities/${city}/places`)).body.places.map((p) => p.name);

test('every place from both workbooks is imported and live, with a History entry each', async () => {
  const counts = Object.fromEntries((await t.db.query(
    "SELECT city_id, COUNT(*)::int AS n FROM heritage_places WHERE status = 'verified' GROUP BY city_id")).rows.map((r) => [r.city_id, r.n]));
  assert.deepEqual(counts, { udaipur: 20, kolkata: 305 });
  assert.equal((await publicNames('kolkata')).length, 305);
  const logged = (await t.db.query("SELECT COUNT(*)::int AS n FROM content_log WHERE entity = 'place' AND action = 'verify'")).rows[0].n;
  assert.equal(logged, 325);
  const writers = (await t.db.query("SELECT * FROM heritage_places WHERE code = 'KOL-BLT-0001'")).rows[0];
  assert.equal(writers.name, "Writers' Building");
  assert.equal(writers.source_url, 'https://en.wikipedia.org/wiki/Writers%27_Building');
  assert.equal(writers.details.Architect_Builder, 'Thomas Lyon', 'the other research columns are kept');
});

test('only editors see the editor list', async () => {
  assert.equal((await learner('/api/admin/cities/udaipur/places')).status, 403);
  const r = await asha('/api/admin/cities/udaipur/places');
  assert.equal(r.status, 200);
  assert.equal(r.body.places.length, 20);
});

test('an edited place goes back to needs check, and the person who changed it cannot verify it', async () => {
  const lake = (await asha('/api/admin/cities/udaipur/places')).body.places.find((p) => p.name === 'Lake Pichola');
  assert.equal(lake.status, 'verified');
  const edit = (over) => asha(`/api/admin/places/${lake.id}`, { cityId: 'udaipur', name: lake.name, subcategory: lake.subcategory,
    description: lake.description, latitude: lake.latitude, longitude: lake.longitude, sourceUrl: '', ...over }, 'PUT');
  assert.equal((await edit({ latitude: 'north' })).status, 400, 'coordinates must be numbers');
  let r = await edit({ sourceUrl: 'https://en.wikipedia.org/wiki/Lake_Pichola' });
  assert.equal(r.status, 200);
  assert.equal(r.body.backToCheck, true);
  assert.ok(!(await publicNames('udaipur')).includes('Lake Pichola'), 'hidden again until re-checked');
  assert.equal((await asha(`/api/admin/places/${lake.id}/verify`, {})).status, 403, 'four eyes');
  assert.equal((await neel(`/api/admin/places/${lake.id}/verify`, {})).status, 200);
  assert.ok((await publicNames('udaipur')).includes('Lake Pichola'));
});
