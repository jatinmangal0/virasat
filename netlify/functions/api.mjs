// The live Virasat API: the shared routes in server/core.js, backed by Netlify Database (Postgres).
import { getDatabase } from '@netlify/database';
import { createApi } from '../../server/core.js';
import { pgStore } from '../../server/lib/store-pg.js';
import { makeSmsSender, makeGoogleVerifier } from '../../server/lib/providers.js';

const env = (k) => Netlify.env.get(k) || '';
const googleClientId = env('GOOGLE_CLIENT_ID');
const handle = createApi({
  store: pgStore(getDatabase().pool),
  sms: makeSmsSender({
    TWILIO_ACCOUNT_SID: env('TWILIO_ACCOUNT_SID'), TWILIO_AUTH_TOKEN: env('TWILIO_AUTH_TOKEN'), TWILIO_FROM: env('TWILIO_FROM'),
  }),
  googleClientId,
  verifyGoogle: makeGoogleVerifier(googleClientId),
  secureCookies: true,
});

export default async (req, context) => {
  let body = null;
  if (req.method === 'POST') {
    const text = await req.text();
    if (text.length > 20_000) return Response.json({ error: 'Request too large.' }, { status: 413 });
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return Response.json({ error: 'Bad JSON.' }, { status: 400 });
    }
  }
  try {
    const out = await handle({
      method: req.method, path: new URL(req.url).pathname, body,
      cookieHeader: req.headers.get('cookie'), ip: context.ip,
    });
    const headers = new Headers({ 'cache-control': 'no-store' });
    for (const c of out.cookies) headers.append('set-cookie', c);
    return Response.json(out.body, { status: out.status, headers });
  } catch (e) {
    console.error('[virasat] API error:', e);
    return Response.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
  }
};

export const config = { path: '/api/*' };
