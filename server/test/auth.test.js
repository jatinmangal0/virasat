import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../lib/db.js';
import { createApp } from '../app.js';

let server, base;
const sent = [];
const sms = { mode: 'demo', async send(phone, text) { sent.push({ phone, text }); } };
const verifyGoogle = async (tok) => {
  if (tok === 'good') return { sub: 'g-123', email: 'asha@example.com', name: 'Asha G', picture: 'https://x/p.png' };
  if (tok === 'neel') return { sub: 'g-456', email: 'neel@example.com', name: 'Neel', picture: null };
  throw new Error('bad token');
};

// Runs on in-memory SQLite by default. With VIRASAT_TEST_PG_URL set (see netlify/test/run-pg-tests.mjs)
// the same tests run on Postgres, the way the live site stores data.
let pool;
before(async () => {
  const pgUrl = process.env.VIRASAT_TEST_PG_URL;
  let store;
  if (pgUrl) {
    const { default: pg } = await import('pg');
    const { pgStore } = await import('../lib/store-pg.js');
    pool = new pg.Pool({ connectionString: pgUrl });
    store = pgStore(pool);
  }
  const app = createApp({ db: store ? null : openDb(':memory:'), store, sms, verifyGoogle, googleClientId: 'cid' });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await pool?.end(); });

function client() {
  let cookie = '';
  return async (path, body, method = body ? 'POST' : 'GET') => {
    const res = await fetch(base + path, {
      method, headers: { 'content-type': 'application/json', cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
}

test('email sign up, me, logout, log in', async () => {
  const c = client();
  let r = await c('/api/auth/signup', { name: 'Ravi', email: 'Ravi@Example.com', password: 'longenough' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.email, 'ravi@example.com');
  r = await c('/api/me');
  assert.equal(r.body.user.name, 'Ravi');
  await c('/api/auth/logout', {});
  r = await c('/api/me');
  assert.equal(r.body.user, null);
  r = await c('/api/auth/login', { email: 'ravi@example.com', password: 'wrongpass' });
  assert.equal(r.status, 401);
  r = await c('/api/auth/login', { email: 'ravi@example.com', password: 'longenough' });
  assert.equal(r.status, 200);
});

test('sign up rejects duplicates and weak input', async () => {
  const c = client();
  assert.equal((await c('/api/auth/signup', { name: 'X', email: 'ravi@example.com', password: 'longenough' })).status, 409);
  assert.equal((await c('/api/auth/signup', { name: 'X', email: 'nope', password: 'longenough' })).status, 400);
  assert.equal((await c('/api/auth/signup', { name: 'X', email: 'x@y.com', password: 'short' })).status, 400);
});

test('phone OTP: request, wrong code, right code, resend cooldown', async () => {
  const c = client();
  let r = await c('/api/auth/otp/request', { phone: '98765 43210' });
  assert.equal(r.status, 200);
  assert.equal(r.body.phone, '+919876543210');
  assert.equal(r.body.isNew, true);
  assert.match(r.body.demoCode, /^\d{6}$/);
  assert.ok(sent.at(-1).text.includes(r.body.demoCode));
  const code = r.body.demoCode;
  assert.equal((await c('/api/auth/otp/request', { phone: '9876543210' })).status, 429);
  const wrong = code === '000000' ? '111111' : '000000';
  r = await c('/api/auth/otp/verify', { phone: '+91 98765 43210', code: wrong });
  assert.equal(r.status, 401);
  r = await c('/api/auth/otp/verify', { phone: '9876543210', code, name: 'Meera' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.name, 'Meera');
  r = await c('/api/auth/otp/verify', { phone: '9876543210', code });
  assert.equal(r.status, 400, 'code is single-use');
});

test('OTP locks after five wrong tries', async () => {
  const c = client();
  const { body } = await c('/api/auth/otp/request', { phone: '+1 415 555 0100' });
  const wrong = body.demoCode === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await c('/api/auth/otp/verify', { phone: '+14155550100', code: wrong });
  const r = await c('/api/auth/otp/verify', { phone: '+14155550100', code: body.demoCode });
  assert.equal(r.status, 429);
});

test('Google sign-in creates, then reuses, the account', async () => {
  const c = client();
  assert.equal((await c('/api/auth/google', { credential: 'forged' })).status, 401);
  let r = await c('/api/auth/google', { credential: 'good' });
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.user.via, ['google']);
  r = await c('/api/auth/google', { credential: 'good' });
  assert.equal(r.status, 200);
  r = await c('/api/auth/signup', { name: 'Imposter', email: 'asha@example.com', password: 'longenough' });
  assert.equal(r.status, 409, 'cannot attach a password to a Google account by email');
});

test('Google takes over a same-email password account and drops the password', async () => {
  const squatter = client();
  await squatter('/api/auth/signup', { name: 'Squatter', email: 'neel@example.com', password: 'longenough' });
  const owner = client();
  const r = await owner('/api/auth/google', { credential: 'neel' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.user.via, ['google']);
  assert.equal((await squatter('/api/me')).body.user, null, 'old sessions are revoked');
  assert.equal((await squatter('/api/auth/login', { email: 'neel@example.com', password: 'longenough' })).status, 401);
});

test('progress needs login and validates input', async () => {
  const anon = client();
  assert.equal((await anon('/api/progress')).status, 401);
  const c = client();
  await c('/api/auth/login', { email: 'ravi@example.com', password: 'longenough' });
  assert.equal((await c('/api/progress/visit', { city: 'paris' })).status, 400);
  assert.equal((await c('/api/progress/visit', { city: 'udaipur' })).status, 200);
  await c('/api/progress/visit', { city: 'udaipur' });
  assert.equal((await c('/api/progress/quiz', { city: 'kolkata', score: 9, total: 5 })).status, 400);
  assert.equal((await c('/api/progress/quiz', { city: 'kolkata', score: 4, total: 5 })).status, 201);
  const r = await c('/api/progress');
  assert.equal(r.body.visits[0].count, 2);
  assert.equal(r.body.quizzes[0].best, 4);
});
