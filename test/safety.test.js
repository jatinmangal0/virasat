// The live site's guard rails: no demo phone login, and corrected facts.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t;
// allowDemoSms: false is how api/index.js starts the API on the live (production) site
before(async () => { t = await startServer({ allowDemoSms: false }); });
after(() => t.stop());

test('without real SMS, the live site switches phone login off instead of showing the code', async () => {
  const c = t.client();
  assert.equal((await c('/api/config')).body.smsMode, 'off');
  const r = await c('/api/auth/otp/request', { phone: '98765 43210' });
  assert.equal(r.status, 503);
  assert.equal(r.body.demoCode, undefined, 'no login code is ever sent back');
  assert.equal((await c('/api/auth/otp/verify', { phone: '98765 43210', code: '123456' })).status, 503);
  assert.equal(t.sent.length, 0);
});

test('email sign-up still works with phone login off', async () => {
  const r = await t.client()('/api/auth/signup', { name: 'Ira', email: 'ira@example.com', password: 'longenough' });
  assert.equal(r.status, 201);
});

test('Udaipur is founded in 1553, and the palace begun in 1559', async () => {
  const udaipur = (await t.client()('/api/cities')).body.cities.find((c) => c.id === 'udaipur');
  assert.match(udaipur.letter[0], /founded it in 1553/);
  assert.deepEqual(udaipur.quickFacts[0], ['Founded', '1553']);
  const events = (await t.db.query("SELECT year_label, title FROM timeline_events WHERE city_id = 'udaipur' ORDER BY sort_order, id")).rows;
  const years = events.map((e) => e.year_label);
  assert.ok(years.indexOf('1553') >= 0 && years.indexOf('1553') + 1 === years.indexOf('1559'), 'founded 1553, then the palace in 1559');
  assert.equal(events.find((e) => e.year_label === '1553').title, 'Udaipur is founded');
  const q = (await t.db.query("SELECT question FROM quiz_questions WHERE city_id = 'udaipur' ORDER BY sort_order, id LIMIT 1")).rows[0];
  assert.doesNotMatch(q.question, /1559/);
});

test('no migration may mark content as verified: that is a second person\'s job on the editor page', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../db/migrations/', import.meta.url);
  // 20261027110100 is the one that did it before this rule existed; its places were sent back by 20261030120000.
  const offenders = readdirSync(dir).filter((f) => f.endsWith('.sql') && f !== '20261027110100_verify_aksh_places.sql')
    .filter((f) => /status\s*=\s*'verified'/i.test(readFileSync(new URL(f, dir), 'utf8').replace(/--.*$/gm, '').replace(/WHERE[^;]*/gi, '')));
  assert.deepEqual(offenders, []);
});

test('uptime checks get an answer without waking the database, and public data may be cached briefly', async () => {
  const c = t.client();
  assert.deepEqual((await c('/api/health')).body, { ok: true });
  const res = await fetch(t.base + '/api/cities');
  assert.match(res.headers.get('cache-control'), /s-maxage=60/);
  const me = await fetch(t.base + '/api/me');
  assert.equal(me.headers.get('cache-control'), 'no-store');
});

test('a city has its own address, and an unknown one gets the 404 page', async () => {
  const city = await fetch(t.base + '/udaipur');
  assert.equal(city.status, 200);
  assert.match(await city.text(), /<title>Virasat/);
  const lost = await fetch(t.base + '/no/such/page');
  assert.equal(lost.status, 404);
  assert.match(await lost.text(), /This lane leads nowhere/);
});

