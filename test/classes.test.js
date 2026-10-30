// Classes: a teacher's code, students who join with a nickname only, and the teacher's results view.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { newCode } from '../server/api/classes.js';

let t, teacher, code;
before(async () => {
  t = await startServer();
  await t.db.query("UPDATE quiz_questions SET status = 'verified' WHERE city_id = 'udaipur'");
  teacher = await t.person('Dsouza');
});
after(() => t.stop());

test('class codes are six letters and digits without look-alikes', () => {
  for (let i = 0; i < 50; i++) assert.match(newCode(), /^[A-HJ-KM-NP-Z2-9]{6}$/);
});

test('a teacher starts a class and gets a code', async () => {
  assert.equal((await t.client()('/api/classes', { name: 'Class 8B' })).status, 401);
  assert.equal((await teacher('/api/classes', { name: 'x' })).status, 400);
  const r = await teacher('/api/classes', { name: 'Class 8B Social Science' });
  assert.equal(r.status, 201);
  code = r.body.class.code;
  assert.deepEqual((await teacher('/api/classes')).body.teaching.map((c) => [c.code, c.students]), [[code, 0]]);
});

test('a student joins with the code and a nickname only, and no personal data is kept', async () => {
  const kid = t.client();
  assert.equal((await kid('/api/classes/join', { code: 'ZZZZZZ', nickname: 'Ananya' })).status, 404);
  const r = await kid('/api/classes/join', { code: code.toLowerCase(), nickname: 'Ananya' });
  assert.equal(r.status, 201);
  const me = (await kid('/api/me')).body.user;
  assert.deepEqual([me.name, me.email, me.phone, me.via], ['Ananya', null, null, []]);
  assert.equal((await t.client()('/api/classes/join', { code, nickname: 'ananya' })).status, 409, 'the name is taken in this class');
  assert.equal((await teacher('/api/classes/join', { code, nickname: 'Me' })).status, 400, 'a teacher does not join their own class');
  t.kid = kid;
});

test('the teacher sets homework and sees each student\'s progress; nobody else can', async () => {
  assert.equal((await teacher(`/api/classes/${code}/assign`, { city: 'udaipur', dueOn: '2026-11-15' })).status, 200);
  assert.deepEqual((await t.kid('/api/classes')).body.member[0].homework, [{ city: 'udaipur', dueOn: '2026-11-15' }]);
  await t.kid('/api/progress/visit', { city: 'udaipur' });
  const qs = (await t.db.query("SELECT id, answer_index FROM quiz_questions WHERE city_id = 'udaipur' AND status = 'verified' ORDER BY id")).rows;
  for (const q of qs) await t.kid('/api/quiz/check', { id: q.id, choice: q.answer_index });
  await t.kid('/api/progress/quiz', { city: 'udaipur', answers: qs.map((q) => ({ id: q.id, choice: q.answer_index })) });
  const r = await teacher(`/api/classes/${code}/results`);
  assert.equal(r.status, 200);
  const ananya = r.body.students.find((s) => s.name === 'Ananya');
  assert.equal(ananya.cities.udaipur.opened, 1);
  assert.equal(ananya.cities.udaipur.best.score, qs.length);
  assert.equal(ananya.cities.udaipur.stamp, 1, 'sealing the letter pressed the stamp');
  assert.equal((await t.kid(`/api/classes/${code}/results`)).status, 403);
});
