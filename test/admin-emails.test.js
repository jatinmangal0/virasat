// The admin email list: Google sign-ins with a listed address become admins; nobody else does.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

let t;
before(async () => { t = await startServer({ adminEmails: 'Neel@Example.com', adminListTtlMs: 0 }); });
after(() => t.stop());

test('an address in ADMIN_EMAILS is admin from the first Google sign-in', async () => {
  const c = t.client();
  const r = await c('/api/auth/google', { credential: 'neel' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, 'admin');
  assert.equal((await c('/api/admin/users')).status, 200);
});

test('a password account with a listed address is not admin: the email was never checked', async () => {
  await t.db.query("INSERT INTO admin_emails (email) VALUES ('asha@example.com')");
  const c = t.client();
  const r = await c('/api/auth/signup', { name: 'Fake Asha', email: 'asha@example.com', password: 'longenough' });
  assert.equal(r.body.user.role, 'learner');
  assert.equal((await c('/api/me')).body.user.role, 'learner');
  assert.equal((await c('/api/admin/users')).status, 403);
});

test('signing in with Google takes that account over and makes it admin', async () => {
  const c = t.client();
  const r = await c('/api/auth/google', { credential: 'good' });
  assert.equal(r.body.user.role, 'admin');
  assert.deepEqual(r.body.user.via, ['google']);
});

test('someone added to the table while signed in becomes admin on their next request', async () => {
  await t.db.query("DELETE FROM admin_emails WHERE email = 'asha@example.com'");
  const asha = (await t.db.query("SELECT id FROM users WHERE email = 'asha@example.com'")).rows[0];
  await t.db.query("UPDATE users SET role = 'learner' WHERE id = $1", [asha.id]);
  const c = t.client();
  assert.equal((await c('/api/auth/google', { credential: 'good' })).body.user.role, 'learner');
  await t.db.query("INSERT INTO admin_emails (email) VALUES ('asha@example.com')");
  assert.equal((await c('/api/me')).body.user.role, 'admin');
  const log = (await t.db.query("SELECT * FROM content_log WHERE action = 'role' AND entity_id = $1", [String(asha.id)])).rows;
  assert.ok(log.length >= 1);
});

test('the table only takes lower-case addresses', async () => {
  await assert.rejects(t.db.query("INSERT INTO admin_emails (email) VALUES ('Big@Example.com')"));
});
