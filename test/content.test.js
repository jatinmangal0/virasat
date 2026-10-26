// The public website only ever sees verified content, and quiz answers stay on the server.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t;
before(async () => { t = await startServer(); });
after(() => t.stop());

test('imported content is hidden until someone verifies it', async () => {
  const c = t.client();
  const { body } = await c('/api/cities');
  assert.deepEqual(body.cities.map((x) => x.id), ['udaipur', 'kolkata']);
  const udaipur = body.cities[0];
  assert.equal(udaipur.letter.length, 2, 'the letter intro is shown');
  assert.deepEqual(udaipur.sections.map((s) => s.id), ['landmarks', 'festivals', 'food', 'facts']);
  assert.equal(udaipur.sections.flatMap((s) => s.items).length, 0, 'no fact cards yet');
  assert.equal(udaipur.quiz.length, 0, 'no quiz questions yet');
});

test('a verified fact and question appear, without the answer', async () => {
  await t.db.query("UPDATE facts SET status = 'verified' WHERE title = 'City Palace'");
  await t.db.query("UPDATE quiz_questions SET status = 'verified' WHERE question LIKE 'Who founded Udaipur%'");
  const c = t.client();
  const udaipur = (await c('/api/cities')).body.cities[0];
  const cards = udaipur.sections.flatMap((s) => s.items);
  assert.deepEqual(cards.map((x) => x.title), ['City Palace']);
  assert.match(cards[0].src, /^https:\/\//);
  assert.equal(udaipur.quiz.length, 1);
  assert.equal('answer' in udaipur.quiz[0], false, 'answers are not sent to the browser');

  const q = udaipur.quiz[0];
  assert.deepEqual((await c('/api/quiz/check', { id: q.id, choice: 1 })).body, { correct: true, answer: 1 });
  assert.equal((await c('/api/quiz/check', { id: q.id, choice: 0 })).body.correct, false);
});

test('an unverified question cannot be checked', async () => {
  const { rows } = await t.db.query("SELECT id FROM quiz_questions WHERE status = 'needs_check' LIMIT 1");
  assert.equal((await t.client()('/api/quiz/check', { id: rows[0].id, choice: 0 })).status, 404);
});

test('an unpublished city disappears', async () => {
  await t.db.query("UPDATE cities SET published = false WHERE id = 'kolkata'");
  assert.deepEqual((await t.client()('/api/cities')).body.cities.map((x) => x.id), ['udaipur']);
  await t.db.query("UPDATE cities SET published = true WHERE id = 'kolkata'");
});
