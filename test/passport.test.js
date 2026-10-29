// The Fading Passport: stamps pressed by sealing a letter, faded by time, re-inked by recall.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { nextBox, dueAfter, inkOf, KEPT } from '../server/api/passport.js';

const DAY = 24 * 60 * 60 * 1000;

test('the Leitner rule: up a box when passed, back to box 1 when not, kept for good at box 4', () => {
  assert.deepEqual([1, 2, 3, 4].map((b) => nextBox(b, true)), [2, 3, 4, 4]);
  assert.deepEqual([1, 2, 3, 4].map((b) => nextBox(b, false)), [1, 1, 1, 1]);
  const now = new Date('2026-11-01T00:00:00Z');
  assert.deepEqual([1, 2, 3].map((b) => (dueAfter(b, now) - now) / DAY), [2, 7, 21]);
  assert.equal(dueAfter(KEPT, now), null);
});

test('ink: fresh until due, then fades a little each day, never below 0.3', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  assert.equal(inkOf(null, now), 1);
  assert.equal(inkOf(new Date(now.getTime() + DAY), now), 1);
  assert.equal(inkOf(now, now), 0.85);
  assert.equal(inkOf(new Date(now.getTime() - 3 * DAY), now), 0.55);
  assert.equal(inkOf(new Date(now.getTime() - 30 * DAY), now), 0.3);
});

let t, me, qs;
before(async () => {
  t = await startServer();
  await t.db.query("UPDATE quiz_questions SET status = 'verified' WHERE city_id = 'kolkata'");
  qs = (await t.db.query("SELECT id, answer_index FROM quiz_questions WHERE city_id = 'kolkata' ORDER BY id")).rows;
  me = await t.person('Mira');
});
after(() => t.stop());

const seal = (right, n = 5) => me('/api/progress/quiz', { city: 'kolkata',
  answers: qs.slice(0, n).map((q, i) => ({ id: q.id, choice: i < right ? q.answer_index : (q.answer_index + 1) % 4 })) });
const makeDue = () => t.db.query("UPDATE stamps SET due_at = now() - interval '1 day'");
const recall = async (allRight) => {
  const letter = (await me('/api/recall/kolkata')).body;
  const key = Object.fromEntries(qs.map((q) => [q.id, q.answer_index]));
  return me('/api/recall/kolkata', { answers: letter.questions.map((q) => ({ id: q.id, choice: allRight ? key[q.id] : (key[q.id] + 1) % 4 })) });
};

test('sealing a letter with 3 in 5 or better presses the stamp; 2 in 5 does not', async () => {
  assert.equal((await t.client()('/api/passport')).status, 401);
  assert.equal((await seal(2)).body.stamp, false);
  assert.deepEqual((await me('/api/passport')).body.stamps, []);
  const r = await seal(3);
  assert.equal(r.body.total, 5, 'marked out of the questions answered');
  assert.equal(r.body.stamp, true);
  assert.equal((await seal(5)).body.stamp, false, 'only pressed once');
  const [s] = (await me('/api/passport')).body.stamps;
  assert.deepEqual([s.city, s.box, s.due, s.ink], ['kolkata', 1, false, 1]);
});

test('a fresh stamp cannot be recalled; a due one fades and gets a three-question letter without answers', async () => {
  assert.equal((await me('/api/recall/kolkata')).status, 409);
  assert.equal((await me('/api/recall/udaipur')).status, 404);
  await makeDue();
  const [s] = (await me('/api/passport')).body.stamps;
  assert.equal(s.due, true);
  assert.ok(s.ink < 1);
  const letter = (await me('/api/recall/kolkata')).body;
  assert.equal(letter.questions.length, 3);
  assert.ok(letter.questions.every((q) => !('answer' in q) && !('answer_index' in q)));
});

test('passing moves the stamp up a box, re-inks it and pays 15 once; failing sends it back to box 1', async () => {
  let r = await recall(true);
  assert.deepEqual([r.body.passed, r.body.box, r.body.ink, r.body.earned], [true, 2, 1, 15]);
  assert.equal((await me('/api/recall/kolkata', { answers: [] })).status, 409, 'fresh again');
  await makeDue();
  r = await recall(false);
  assert.deepEqual([r.body.passed, r.body.box, r.body.earned], [false, 1, 0]);
  await makeDue();
  r = await recall(true);
  assert.deepEqual([r.body.box, r.body.earned], [2, 0], 'reaching box 2 again pays nothing');
  for (const box of [3, 4]) { await makeDue(); r = await recall(true); assert.equal(r.body.box, box); }
  assert.equal(r.body.dueAt, null, 'kept for good');
  const [s] = (await me('/api/passport')).body.stamps;
  assert.deepEqual([s.box, s.due, s.ink], [4, false, 1]);
});
