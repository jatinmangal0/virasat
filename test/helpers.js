// Shared test setup: a fresh, empty local Postgres with every migration applied, and the API on a
// random port. Each test file gets its own database, so files never see each other's data.
import pg from 'pg';
import { NetlifyDB } from '@netlify/database-dev';
import { fileURLToPath } from 'node:url';
import { createApi } from '../server/api/index.js';
import { createExpressApp } from '../server/express-app.js';

const migrations = fileURLToPath(new URL('../netlify/database/migrations', import.meta.url));

export const SETUP_CODE = 'test-setup-code';

export async function startServer() {
  const local = new NetlifyDB();
  const db = new pg.Pool({ connectionString: await local.start() });
  await local.applyMigrations(migrations);
  const sent = [];
  const sms = { mode: 'demo', async send(phone, text) { sent.push({ phone, text }); } };
  const verifyGoogle = async (tok) => {
    if (tok === 'good') return { sub: 'g-123', email: 'asha@example.com', name: 'Asha G', picture: 'https://x/p.png' };
    if (tok === 'neel') return { sub: 'g-456', email: 'neel@example.com', name: 'Neel', picture: null };
    throw new Error('bad token');
  };
  const app = createExpressApp(createApi({ db, sms, verifyGoogle, googleClientId: 'cid', adminSetupCode: SETUP_CODE }));
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  // A browser-like client that keeps its own login cookie.
  const client = () => {
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
  };

  // Signs up a new person and gives them a role directly in the database.
  const person = async (name, role = 'learner') => {
    const c = client();
    const email = `${name.toLowerCase()}@example.com`;
    const r = await c('/api/auth/signup', { name, email, password: 'longenough' });
    if (role !== 'learner') await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, r.body.user.id]);
    c.id = r.body.user.id;
    return c;
  };

  const stop = async () => { server.close(); await db.end(); await local.stop(); };
  return { db, sent, client, person, stop };
}
