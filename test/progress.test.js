// Points and progress: worked out on the server, and each thing pays only once.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t, me, questions;
before(async () => {
  t = await startServer();
  await t.db.query("UPDATE quiz_questions SET status = 'verified' WHERE city_id = 'kolkata'");
  questions = (await t.db.query("SELECT id, answer_index FROM quiz_questions WHERE city_id = 'kolkata' ORDER BY id")).rows;
  me = await t.person('Ravi');
});
after(() => t.stop());

test('progress needs a login', async () => {
  const anon = t.client();
  assert.equal((await anon('/api/progress')).status, 401);
  assert.equal((await anon('/api/progress/visit', { city: 'udaipur' })).status, 401);
});

test('opening a city pays 10 points the first time only', async () => {
  assert.equal((await me('/api/progress/visit', { city: 'paris' })).status, 400);
  let r = await me('/api/progress/visit', { city: 'udaipur' });
  assert.deepEqual(r.body, { earned: 10, points: 10 });
  r = await me('/api/progress/visit', { city: 'udaipur' });
  assert.deepEqual(r.body, { earned: 0, points: 10 });
});

test('reading a section pays 5 points once and is remembered', async () => {
  assert.equal((await me('/api/progress/section', { city: 'udaipur', section: 'nope' })).status, 400);
  assert.equal((await me('/api/progress/section', { city: 'udaipur', section: 'food' })).body.earned, 5);
  assert.equal((await me('/api/progress/section', { city: 'udaipur', section: 'food' })).body.earned, 0);
  const p = (await me('/api/progress')).body;
  assert.deepEqual(p.covered, [{ city: 'udaipur', section: 'food' }]);
  assert.equal(p.points, 15);
});

test('the server marks the quiz and pays only for improvement', async () => {
  const answers = (right) => questions.map((q, i) => ({ id: q.id, choice: i < right ? q.answer_index : (q.answer_index + 1) % 4 }));
  let r = await me('/api/progress/quiz', { city: 'kolkata', answers: answers(3) });
  assert.equal(r.status, 201);
  assert.deepEqual([r.body.score, r.body.total, r.body.earned], [3, 5, 30]);
  r = await me('/api/progress/quiz', { city: 'kolkata', answers: answers(2) });
  assert.equal(r.body.earned, 0, 'a worse score earns nothing');
  r = await me('/api/progress/quiz', { city: 'kolkata', answers: answers(5) });
  assert.equal(r.body.earned, 20, 'beating your best pays the difference');
  r = await me('/api/progress/quiz', { city: 'kolkata', answers: answers(5) });
  assert.equal(r.body.earned, 0);
  const p = (await me('/api/progress')).body;
  assert.equal(p.points, 65);
  assert.deepEqual(p.quizzes.map((q) => [q.city, q.best, q.total, q.attempts]), [['kolkata', 5, 5, 4]]);
});

test('a quiz with nothing verified cannot be submitted, and faked scores are ignored', async () => {
  assert.equal((await me('/api/progress/quiz', { city: 'udaipur', answers: [] })).status, 400);
  const r = await me('/api/progress/quiz', { city: 'kolkata', answers: [], score: 5, total: 5 });
  assert.equal(r.body.score, 0, 'the server ignores a score the browser makes up');
});
