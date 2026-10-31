// The live Virasat API on Vercel. All the rules live in server/api/; this file only connects
// Vercel's requests to them and hands over the database and the secret settings.
// vercel.json sends every /api/... request here, with the original path in ?__p=.
import { createApi } from '../server/api/index.js';
import { makePool } from '../server/lib/db.js';
import { toWebHandler } from '../server/lib/web-handler.js';
import { makeSmsSender, makeGoogleVerifier } from '../server/lib/providers.js';

const env = (k) => process.env[k] || '';
const googleClientId = env('GOOGLE_CLIENT_ID');
const handle = createApi({
  db: makePool(),
  sms: makeSmsSender(),
  googleClientId,
  verifyGoogle: makeGoogleVerifier(googleClientId),
  secureCookies: true,
  adminSetupCode: env('ADMIN_SETUP_CODE'),
  // demo SMS shows the login code on screen; allow it on preview links, never on the live site
  allowDemoSms: env('VERCEL_ENV') !== 'production',
});

const web = toWebHandler(handle, {
  path: (req) => {
    const p = new URL(req.url).searchParams.get('__p');
    return p == null ? new URL(req.url).pathname : '/api/' + p;
  },
  ip: (req) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim(),
});

export const GET = web;
export const POST = web;
export const PUT = web;
export const DELETE = web;
export const HEAD = web;
