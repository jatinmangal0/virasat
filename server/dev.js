// Run Virasat on your own computer:   npm run dev   then open http://localhost:3024
//
// It starts a local Postgres database (saved in the .data/ folder, which git ignores), applies every
// file in db/migrations/ that has not run yet, and serves the website and the API.
// This is the same database type and the same API code as the live site, just with local data.
import pg from 'pg';
import { NetlifyDB } from '@netlify/database-dev';
import { fileURLToPath } from 'node:url';
import { createApi } from './api/index.js';
import { createExpressApp } from './express-app.js';
import { makeSmsSender, makeGoogleVerifier } from './lib/providers.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT) || 3024;
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const adminSetupCode = process.env.ADMIN_SETUP_CODE || 'local-admin';

const local = new NetlifyDB({ directory: root + '.data/db' });
const db = new pg.Pool({ connectionString: await local.start() });
await local.applyMigrations(root + 'db/migrations');

const sms = makeSmsSender();
const app = createExpressApp(createApi({
  db, sms, googleClientId, verifyGoogle: makeGoogleVerifier(googleClientId), adminSetupCode,
}));
app.listen(port, () => {
  console.log(`Virasat running at http://localhost:${port}   (editor page: /admin)`);
  console.log(`  Database: local Postgres in .data/db`);
  console.log(`  SMS: ${sms.mode === 'live' ? 'Twilio (live)' : 'demo mode (codes shown on screen)'}`);
  console.log(`  Google sign-in: ${googleClientId ? 'on' : 'off (set GOOGLE_CLIENT_ID)'}`);
  console.log(`  First-admin setup code: ${adminSetupCode}`);
});
