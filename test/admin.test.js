// The editor page's rules: roles, four-eyes verification, re-checking after edits, and the change log.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, SETUP_CODE } from './helpers.js';

let t, learner, asha, neel, boss, sectionId;
before(async () => {
  t = await startServer();
  learner = await t.person('Learner');
  asha = await t.person('Asha', 'editor');
  neel = await t.person('Neel', 'editor');
  sectionId = (await t.db.query("SELECT id FROM sections WHERE city_id = 'udaipur' AND slug = 'food'")).rows[0].id;
});
after(() => t.stop());

const publicTitles = async () => (await t.client()('/api/cities')).body.cities[0].sections.flatMap((s) => s.items).map((i) => i.title);

test('learners and visitors cannot use the editor API', async () => {
  assert.equal((await t.client()('/api/admin/cities')).status, 401);
  assert.equal((await learner('/api/admin/cities')).status, 403);
  assert.equal((await learner('/api/admin/facts', { sectionId, title: 'x', text: 'y' })).status, 403);
  assert.equal((await asha('/api/admin/users')).status, 403, 'editors cannot manage the team');
});

test('the first admin needs the setup code, and only while there is no admin', async () => {
  boss = await t.person('Boss');
  assert.equal((await boss('/api/admin/claim', { code: 'wrong' })).status, 403);
  const r = await boss('/api/admin/claim', { code: SETUP_CODE });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, 'admin');
  assert.equal((await learner('/api/admin/claim', { code: SETUP_CODE })).status, 403, 'a second claim is refused');
});

test('a new fact stays hidden until a different editor verifies it', async () => {
  let r = await asha('/api/admin/facts', { sectionId, title: 'Dal Pakwan', text: 'Crisp flatbread with dal.', sourceUrl: 'not a link' });
  assert.equal(r.status, 400, 'sources must be links');
  r = await asha('/api/admin/facts', { sectionId, title: 'Dal Pakwan', text: 'Crisp flatbread with dal.' });
  assert.equal(r.status, 201);
  const id = r.body.fact.id;
  assert.equal(r.body.fact.status, 'needs_check');
  assert.ok(!(await publicTitles()).includes('Dal Pakwan'));

  assert.equal((await neel(`/api/admin/facts/${id}/verify`, {})).status, 400, 'no source yet');
  await asha(`/api/admin/facts/${id}`, { sectionId, title: 'Dal Pakwan', text: 'Crisp flatbread with dal.', sourceUrl: 'https://example.com/dal' }, 'PUT');
  assert.equal((await asha(`/api/admin/facts/${id}/verify`, {})).status, 403, 'you cannot verify your own fact');
  r = await neel(`/api/admin/facts/${id}/verify`, {});
  assert.equal(r.status, 200);
  assert.equal(r.body.fact.verified_by, neel.id);
  assert.ok((await publicTitles()).includes('Dal Pakwan'));

  r = await neel(`/api/admin/facts/${id}`, { sectionId, title: 'Dal Pakwan', text: 'Crisp fried flatbread with dal.', sourceUrl: 'https://example.com/dal' }, 'PUT');
  assert.equal(r.body.backToCheck, true, 'rewording a verified fact sends it back to be checked');
  assert.ok(!(await publicTitles()).includes('Dal Pakwan'));
  assert.equal((await neel(`/api/admin/facts/${id}/verify`, {})).status, 403, 'the person who reworded it cannot verify it');
  assert.equal((await asha(`/api/admin/facts/${id}/verify`, {})).status, 200);

  assert.equal((await asha(`/api/admin/facts/${id}`, null, 'DELETE')).status, 200);
  assert.ok(!(await publicTitles()).includes('Dal Pakwan'));
});

test('imported facts can be verified by any editor', async () => {
  const { rows } = await t.db.query("SELECT id FROM facts WHERE title = 'City Palace'");
  assert.equal((await asha(`/api/admin/facts/${rows[0].id}/verify`, {})).status, 200);
  assert.ok((await publicTitles()).includes('City Palace'));
});

test('quiz questions follow the same rules', async () => {
  let r = await asha('/api/admin/quiz', { cityId: 'udaipur', question: 'Which lake has Jag Mandir?', options: ['Pichola', 'Fateh Sagar'], answerIndex: 5 });
  assert.equal(r.status, 400);
  r = await asha('/api/admin/quiz', { cityId: 'udaipur', question: 'Which lake has Jag Mandir?', options: ['Pichola', 'Fateh Sagar'], answerIndex: 0, sourceUrl: 'https://example.com/jag' });
  assert.equal(r.status, 201);
  assert.equal((await asha(`/api/admin/quiz/${r.body.quiz.id}/verify`, {})).status, 403);
  assert.equal((await neel(`/api/admin/quiz/${r.body.quiz.id}/verify`, {})).status, 200);
  const quiz = (await t.client()('/api/cities')).body.cities[0].quiz;
  assert.deepEqual(quiz.map((q) => q.q), ['Which lake has Jag Mandir?']);
});

test('a letter change is a draft until a different editor verifies it; editors cannot unpublish a city', async () => {
  const city = (await asha('/api/admin/cities/udaipur')).body.city;
  const live = (await t.client()('/api/cities')).body.cities[0].letter;
  const edit = { name: city.name, native: city.native_name, state: city.state, nickname: city.nickname, greeting: city.greeting,
    greetingNote: city.greeting_note, from: city.from_line, letter: ['One new paragraph.'], quickFacts: city.quick_facts,
    sources: [['Bad', 'nope']], published: false };
  assert.equal((await asha('/api/admin/cities/udaipur', edit, 'PUT')).status, 400);
  edit.sources = city.sources;
  const r = await asha('/api/admin/cities/udaipur', edit, 'PUT');
  assert.equal(r.status, 200);
  assert.equal(r.body.city.published, true, 'only an admin can hide a city');
  assert.deepEqual(r.body.city.draft.letter, ['One new paragraph.']);
  assert.deepEqual((await t.client()('/api/cities')).body.cities[0].letter, live, 'the website still shows the checked letter');
  assert.equal((await asha('/api/admin/cities/udaipur/verify', {})).status, 403, 'the writer cannot verify their own draft');
  assert.equal((await neel('/api/admin/cities/udaipur/verify', {})).status, 200);
  assert.deepEqual((await t.client()('/api/cities')).body.cities[0].letter, ['One new paragraph.']);
  assert.equal((await neel('/api/admin/cities/udaipur/verify', {})).status, 400, 'nothing left to check');
});

test('four eyes: nobody who wrote any of the words may verify them, even after someone else edits', async () => {
  let r = await asha('/api/admin/facts', { sectionId, title: 'Bhutta', text: 'Roasted corn by the lake.', sourceUrl: 'https://example.com/b' });
  const id = r.body.fact.id;
  r = await neel(`/api/admin/facts/${id}`, { sectionId, title: 'Bhutta', text: 'Roasted corn by Fateh Sagar.', sourceUrl: 'https://example.com/b' }, 'PUT');
  assert.deepEqual(r.body.fact.authors.sort(), [asha.id, neel.id].sort());
  assert.equal((await asha(`/api/admin/facts/${id}/verify`, {})).status, 403, 'Asha wrote it');
  assert.equal((await neel(`/api/admin/facts/${id}/verify`, {})).status, 403, 'Neel changed it');
  const boss2 = await t.person('Ira', 'editor');
  r = await boss2(`/api/admin/facts/${id}/verify`, {});
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.fact.authors, [], 'checked: the list starts again');
});

test('four eyes: a verifier must be looking at the latest version', async () => {
  let r = await asha('/api/admin/facts', { sectionId, title: 'Kachori', text: 'Fried and stuffed.', sourceUrl: 'https://example.com/k' });
  const opened = r.body.fact;
  await new Promise((done) => setTimeout(done, 5));
  await asha(`/api/admin/facts/${opened.id}`, { sectionId, title: 'Kachori', text: 'Fried, stuffed with dal.', sourceUrl: 'https://example.com/k' }, 'PUT');
  assert.equal((await neel(`/api/admin/facts/${opened.id}/verify`, { updatedAt: opened.updated_at })).status, 409, 'it changed after Neel opened it');
  const latest = (await asha('/api/admin/cities/udaipur')).body.sections.flatMap((s) => s.facts).find((f) => f.id === opened.id);
  assert.equal((await neel(`/api/admin/facts/${opened.id}/verify`, { updatedAt: latest.updated_at })).status, 200);
});

test('four eyes: moving a live fact to another city sends it back to be checked', async () => {
  const kolkataSection = (await t.db.query("SELECT id FROM sections WHERE city_id = 'kolkata' AND slug = 'food'")).rows[0].id;
  let r = await asha('/api/admin/facts', { sectionId, title: 'Mawa', text: 'Milk cooked down.', sourceUrl: 'https://example.com/m' });
  const id = r.body.fact.id;
  assert.equal((await neel(`/api/admin/facts/${id}/verify`, {})).status, 200);
  r = await neel(`/api/admin/facts/${id}`, { sectionId: kolkataSection, title: 'Mawa', text: 'Milk cooked down.', sourceUrl: 'https://example.com/m' }, 'PUT');
  assert.equal(r.body.backToCheck, true);
});

test('admins manage roles, and the last admin cannot step down', async () => {
  const users = (await boss('/api/admin/users')).body.users;
  assert.equal(users[0].role, 'admin');
  assert.equal((await boss(`/api/admin/users/${learner.id}/role`, { role: 'editor' }, 'PUT')).body.user.role, 'editor');
  assert.equal((await learner('/api/admin/cities')).status, 200, 'the new editor gets in');
  assert.equal((await boss(`/api/admin/users/${boss.id}/role`, { role: 'editor' }, 'PUT')).status, 400);
});

test('every change is in the log, newest first', async () => {
  const log = (await asha('/api/admin/log')).body.log;
  const actions = log.map((l) => `${l.action} ${l.entity}`);
  for (const a of ['create fact', 'update fact', 'verify fact', 'delete fact', 'create quiz', 'update city', 'role user']) {
    assert.ok(actions.includes(a), `log has "${a}"`);
  }
  assert.equal(log[0].action, 'role');
  assert.ok(log.some((l) => l.label === 'Dal Pakwan' && l.user_name === 'Asha'));
});

test('the To check inbox lists every waiting item, marks the ones you wrote, and shows what was live before', async () => {
  let r = await asha('/api/admin/facts', { sectionId, title: 'Malpua', text: 'Sweet fried pancakes.', sourceUrl: 'https://example.com/malpua' });
  const id = r.body.fact.id;
  let inbox = (await asha('/api/admin/inbox')).body.items;
  const mine = inbox.find((x) => x.kind === 'fact' && x.id === id);
  assert.equal(mine.mine, true);
  assert.equal(mine.wasLive, null, 'never live yet');
  assert.ok(inbox.some((x) => x.kind === 'timeline'), 'other kinds are there too');
  await neel(`/api/admin/facts/${id}/verify`, { updatedAt: mine.updatedAt });
  await neel(`/api/admin/facts/${id}`, { sectionId, title: 'Malpua', text: 'Sweet fried pancakes in syrup.', sourceUrl: 'https://example.com/malpua' }, 'PUT');
  inbox = (await asha('/api/admin/inbox')).body.items;
  const back = inbox.find((x) => x.kind === 'fact' && x.id === id);
  assert.deepEqual([back.mine, back.wasLive, back.text], [false, 'Sweet fried pancakes.', 'Sweet fried pancakes in syrup.']);
  assert.equal((await t.client()('/api/admin/inbox')).status, 401);
});

