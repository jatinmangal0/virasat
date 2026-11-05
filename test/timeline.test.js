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
  assert.match(c.outlineSource, /Udaipur Municipal Corporation/);
  assert.deepEqual((await t.client()('/api/greetings')).body.greetings, []);

  const { rows } = await t.db.query("SELECT id FROM timeline_events WHERE city_id = 'udaipur' AND year_label = '1553'");
  assert.equal((await asha(`/api/admin/timeline/${rows[0].id}/verify`, {})).status, 200, 'any editor may verify imported events');
  assert.deepEqual((await udaipur()).timeline.map((e) => [e.year, e.title]), [['1553', 'Udaipur is founded']]);

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

test('demo mode is for the team only', async () => {
  assert.equal((await t.client()('/api/demo')).status, 401);
  assert.equal((await (await t.person('Lina'))('/api/demo')).status, 403);
});

test('demo mode lists unchecked events and greetings, marked as drafts, with their drawings', async () => {
  const { body } = await asha('/api/demo');
  const k = body.timeline.kolkata;
  assert.ok(k.length >= 8 && k.every((e) => e.draft === true));
  assert.equal(k.find((e) => e.year === '1943').motif, 'bridge');
  assert.ok(body.greetings.some((g) => g.word === 'Namaste'));
  assert.ok(!body.greetings.some((g) => g.word === 'Vanakkam'), 'verified greetings are not repeated');
  assert.ok(body.facts.udaipur.landmarks.length > 0 && body.facts.udaipur.landmarks.every((f) => f.draft === true), 'draft fact cards by section');
  assert.ok(body.quiz.kolkata.length > 0 && body.quiz.kolkata.every((q) => Number.isInteger(q.answer)), 'draft quiz with answers, for the team only');
});

test('demo mode lists places that went back to draft, and only those', async () => {
  // 20261030120000_content_fixes.sql sends places with no source, or with research notes in their
  // text, back to "needs check". They show in demo mode as drafts; the rest stay on the real map.
  const { body } = await asha('/api/demo');
  assert.ok(body.places.udaipur.length > 0 && body.places.udaipur.every((p) => p.draft === true && !p.source_url));
  const live = (await t.client()('/api/cities/udaipur/places')).body.places;
  assert.ok(live.every((p) => p.source_url), 'every live place has a source');
});

test('every event is one paragraph: the old record/memory boxes are merged in, and no source is dropped', async () => {
  const { body } = await asha('/api/demo');
  const all = [...body.timeline.udaipur, ...body.timeline.kolkata];
  assert.ok(all.every((e) => !('memory' in e) && !('argued' in e)), 'no event carries a second block of text');
  const hg = body.timeline.udaipur.find((e) => e.title === 'The Battle of Haldighati');
  assert.match(hg.text, /never bowed to Akbar/);
  assert.match(hg.text, /2017/);
  const tp = (await t.db.query("SELECT * FROM timeline_events WHERE city_id = 'kolkata' AND title = 'A trading post on the Hooghly'")).rows[0];
  for (const fact of [/Sutanuti, Gobindapur and Kalikata/, /Job Charnock/, /24 August 1690/, /1495/, /2003 the Calcutta High Court/, /sole founder/]) assert.match(tp.body, fact);
  assert.equal(tp.memory, '');
  assert.match(tp.memory_source_url, /^https:/, 'both sources are kept');
  // an editor can no longer add a second block, and a second source must be a link
  const ev = (await asha('/api/admin/cities/udaipur')).body.timeline.find((e) => e.title === 'The Battle of Haldighati');
  const save = (over) => asha(`/api/admin/timeline/${ev.id}`, { cityId: 'udaipur', year: ev.year_label, title: ev.title, text: ev.body,
    images: [], motif: ev.motif, order: ev.sort_order, sourceUrl: ev.source_url, memorySourceUrl: ev.memory_source_url, ...over }, 'PUT');
  assert.equal((await save({ memorySourceUrl: 'not a link' })).status, 400);
  assert.equal((await save({ memory: 'A second box', argued: 'Why' })).status, 200);
  const after = (await asha('/api/admin/cities/udaipur')).body.timeline.find((e) => e.id === ev.id);
  assert.equal(after.memory, '');
  assert.equal(after.argued, '');
});

test('only major events are shown: minor ones stay in the editor, hidden, and an editor can show one again', async () => {
  const minor = (await t.db.query("SELECT id FROM timeline_events WHERE city_id = 'kolkata' AND title = 'The first trams'")).rows[0].id;
  const major = (await t.db.query("SELECT id FROM timeline_events WHERE city_id = 'kolkata' AND title = 'The Battle of Plassey'")).rows[0].id;
  await neel(`/api/admin/timeline/${minor}/verify`, {});
  await neel(`/api/admin/timeline/${major}/verify`, {});
  const kolkata = async () => (await t.client()('/api/cities')).body.cities.find((c) => c.id === 'kolkata').timeline.map((e) => e.title);
  assert.ok((await kolkata()).includes('The Battle of Plassey'));
  assert.ok(!(await kolkata()).includes('The first trams'), 'a minor event is hidden even when verified');
  const ev = (await neel('/api/admin/cities/kolkata')).body.timeline.find((e) => e.id === minor);
  assert.equal(ev.hidden, true, 'the editor still lists it, marked hidden');
  const r = await neel(`/api/admin/timeline/${minor}`, { cityId: 'kolkata', year: ev.year_label, title: ev.title, text: ev.body, order: ev.sort_order, images: ev.images, sourceUrl: ev.source_url,
    motif: ev.motif, memory: ev.memory, memorySourceUrl: ev.memory_source_url, argued: ev.argued, hidden: false }, 'PUT');
  assert.equal(r.status, 200);
  assert.ok(!r.body.backToCheck, 'showing an event again is not a rewording');
  assert.ok((await kolkata()).includes('The first trams'));
});

test('the Explore history lists every checked event, also the ones kept off the letter', async () => {
  const empty = (await t.client()('/api/cities/kolkata/history')).body.events;
  assert.ok(empty.every((e) => e.title !== 'The great famine'), 'unchecked events are never sent');
  await t.db.query("UPDATE timeline_events SET status = 'verified' WHERE city_id = 'kolkata'");
  const events = (await t.client()('/api/cities/kolkata/history')).body.events;
  const hidden = (await t.db.query("SELECT count(*)::int AS n FROM timeline_events WHERE city_id = 'kolkata' AND hidden")).rows[0].n;
  assert.ok(hidden > 0 && events.length > hidden, 'hidden events are included');
  assert.ok(events.some((e) => !e.major) && events.some((e) => e.major));
  assert.deepEqual(Object.keys(events[0]).sort(), ['id', 'images', 'major', 'motif', 'src', 'text', 'title', 'year']);
  assert.deepEqual((await t.client()('/api/cities/nowhere/history')).body.events, []);
});
