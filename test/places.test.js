// Aksh's heritage places: all imported, hidden until verified, and verified under the same four-eyes rule.
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

test('every place from both workbooks is imported, hidden from the website', async () => {
  const counts = Object.fromEntries((await t.db.query(
    "SELECT city_id, COUNT(*)::int AS n FROM heritage_places WHERE status = 'needs_check' GROUP BY city_id")).rows.map((r) => [r.city_id, r.n]));
  assert.deepEqual(counts, { udaipur: 20, kolkata: 305 });
  assert.deepEqual(await publicNames('kolkata'), []);
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

test('a place needs a source, and the person who changed it last cannot verify it', async () => {
  const lake = (await asha('/api/admin/cities/udaipur/places')).body.places.find((p) => p.name === 'Lake Pichola');
  assert.equal(lake.source_url, '');
  assert.equal((await asha(`/api/admin/places/${lake.id}/verify`, {})).status, 400, 'no source yet');

  let r = await asha(`/api/admin/places/${lake.id}`, { cityId: 'udaipur', name: lake.name, subcategory: lake.subcategory,
    description: lake.description, latitude: 'north', longitude: lake.longitude, sourceUrl: 'https://en.wikipedia.org/wiki/Lake_Pichola' }, 'PUT');
  assert.equal(r.status, 400, 'coordinates must be numbers');
  r = await asha(`/api/admin/places/${lake.id}`, { cityId: 'udaipur', name: lake.name, subcategory: lake.subcategory,
    description: lake.description, latitude: lake.latitude, longitude: lake.longitude, sourceUrl: 'https://en.wikipedia.org/wiki/Lake_Pichola' }, 'PUT');
  assert.equal(r.status, 200);
  assert.equal((await asha(`/api/admin/places/${lake.id}/verify`, {})).status, 403, 'four eyes');
  assert.equal((await neel(`/api/admin/places/${lake.id}/verify`, {})).status, 200);
  assert.deepEqual(await publicNames('udaipur'), ['Lake Pichola']);
});

test('an imported place with a source can be verified by any editor', async () => {
  const { id } = (await t.db.query("SELECT id FROM heritage_places WHERE code = 'KOL-BLT-0001'")).rows[0];
  assert.equal((await asha(`/api/admin/places/${id}/verify`, {})).status, 200);
  const [p] = (await t.client()('/api/cities/kolkata/places')).body.places;
  assert.equal(p.name, "Writers' Building");
  assert.ok(p.latitude && p.longitude);
});
