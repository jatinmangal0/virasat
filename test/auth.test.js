// Signing up and logging in.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t, client, sent;
before(async () => { t = await startServer(); ({ client, sent } = t); });
after(() => t.stop());

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

test('the browser learns the role of whoever is logged in', async () => {
  const c = client();
  await c('/api/auth/login', { email: 'ravi@example.com', password: 'longenough' });
  assert.equal((await c('/api/me')).body.user.role, 'learner');
});

test('delete my account removes the person and logs them out', async () => {
  const c = client();
  const r = await c('/api/auth/signup', { name: 'Gone', email: 'gone@example.com', password: 'longenough' });
  assert.equal((await c('/api/auth/delete-account', {})).status, 400);
  assert.equal((await c('/api/auth/delete-account', { confirm: 'DELETE' })).status, 200);
  assert.equal((await c('/api/me')).body.user, null);
  assert.equal((await t.db.query('SELECT 1 FROM users WHERE id = $1', [r.body.user.id])).rowCount, 0);
  assert.equal((await client()('/api/auth/delete-account', { confirm: 'DELETE' })).status, 401);
});
