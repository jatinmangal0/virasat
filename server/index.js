import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './lib/db.js';
import { makeSmsSender, makeGoogleVerifier } from './lib/providers.js';
import { createApp } from './app.js';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3024;
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const sms = makeSmsSender();

const app = createApp({
  db: openDb(process.env.DB_FILE || join(here, 'data', 'virasat.db')),
  sms,
  googleClientId,
  verifyGoogle: makeGoogleVerifier(googleClientId),
  secureCookies: process.env.NODE_ENV === 'production',
});
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.listen(port, () => {
  console.log(`Virasat running at http://localhost:${port}`);
  console.log(`  SMS: ${sms.mode === 'live' ? 'Twilio (live)' : 'demo mode (codes shown on screen)'}`);
  console.log(`  Google sign-in: ${googleClientId ? 'on' : 'off (set GOOGLE_CLIENT_ID)'}`);
});
