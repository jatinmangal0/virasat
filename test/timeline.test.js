// The city timeline, the greetings bar and the city outline follow the same check-before-live rules.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t, asha, neel;
before(async () => {
  t = await startServer();
  asha = await t.person('Asha', 'editor');
  neel = await t.person('Neel', 'editor');
});
after(() => t.stop());

const udaipur = async () => (await t.client()('/api/cities')).body.cities.find((c) => c.id === 'udaipur');

test('imported timeline events and greetings are hidden until verified', async () => {
  const c = await udaipur();
  assert.deepEqual(c.timeline, []);
  assert.ok(c.outline.length > 20, 'the city outline is sent');
  assert.ok(c.outline.every(([lng, lat]) => lng > 73 && lng < 74 && lat > 24 && lat < 25), 'outline is [lng, lat] around Udaipur');
  assert.match(c.outlineSource, /DataMeet/);
  assert.deepEqual((await t.client()('/api/greetings')).body.greetings, []);

  const { rows } = await t.db.query("SELECT id FROM timeline_events WHERE city_id = 'udaipur' AND year_label = '1559'");
  assert.equal((await asha(`/api/admin/timeline/${rows[0].id}/verify`, {})).status, 200, 'any editor may verify imported events');
  assert.deepEqual((await udaipur()).timeline.map((e) => [e.year, e.title]), [['1559', 'Udaipur is founded']]);

  const g = (await asha('/api/admin/greetings')).body.greetings;
  assert.ok(g.length >= 10);
  const vanakkam = g.find((x) => x.word === 'Vanakkam');
  assert.equal((await neel(`/api/admin/greetings/${vanakkam.id}/verify`, {})).status, 200);
  assert.deepEqual((await t.client()('/api/greetings')).body.greetings, [{ word: 'Vanakkam', native: 'வணக்கம்', language: 'Tamil' }]);
});

test('a new event needs a second editor, and photos must be https links', async () => {
  const ev = { cityId: 'udaipur', year: '1736', title: 'A test event', text: 'Something happened.', sourceUrl: 'https://example.com/e', order: 4 };
  assert.equal((await asha('/api/admin/timeline', { ...ev, images: [{ src: 'http://x/a.jpg' }] })).status, 400);
  assert.equal((await asha('/api/admin/timeline', { ...ev, year: '' })).status, 400);
  const r = await asha('/api/admin/timeline', { ...ev, images: [{ src: 'https://example.com/a.jpg', caption: 'A' }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.timeline.sort_order, 4, 'the editor chooses where it sits on the timeline');
  assert.equal((await asha(`/api/admin/timeline/${r.body.timeline.id}/verify`, {})).status, 403);
  assert.equal((await neel(`/api/admin/timeline/${r.body.timeline.id}/verify`, {})).status, 200);
  const shown = (await udaipur()).timeline.find((e) => e.title === 'A test event');
  assert.deepEqual(shown.images, [{ src: 'https://example.com/a.jpg', caption: 'A' }]);

  const moved = await asha(`/api/admin/timeline/${r.body.timeline.id}`, { ...ev, order: 9, images: shown.images }, 'PUT');
  assert.equal(moved.body.backToCheck, false, 'moving an event is not a rewording');
  const reworded = await asha(`/api/admin/timeline/${r.body.timeline.id}`, { ...ev, title: 'A new title', order: 9 }, 'PUT');
  assert.equal(reworded.body.backToCheck, true);
});

test('a new greeting needs the word and the language', async () => {
  assert.equal((await asha('/api/admin/greetings', { word: 'Khublei' })).status, 400);
  const r = await asha('/api/admin/greetings', { word: 'Khublei', language: 'Khasi', sourceUrl: 'https://example.com/k' });
  assert.equal(r.status, 201);
  assert.equal(r.body.greeting.status, 'needs_check');
});

test('demo mode lists unchecked events and greetings, marked as drafts, with their drawings', async () => {
  const { body } = await t.client()('/api/demo');
  const k = body.timeline.kolkata;
  assert.ok(k.length >= 9 && k.every((e) => e.draft === true));
  assert.equal(k.find((e) => e.year === '1943').motif, 'bridge');
  assert.ok(body.greetings.some((g) => g.word === 'Namaste'));
  assert.ok(!body.greetings.some((g) => g.word === 'Vanakkam'), 'verified greetings are not repeated');
});
