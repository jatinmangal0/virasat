// The Virasat API with no web framework attached, so the same code runs under Express
// (local, tests) and as a Netlify Function. `store` is SQLite or Postgres (see lib/store-*.js).
import {
  hashPassword, verifyPassword, sha256, newToken, newOtp, safeEqualHex,
  normalizePhone, isEmail, rateLimiter,
} from './lib/security.js';

const SESSION_DAYS = 30;
const COOKIE = 'virasat_sid';
const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_MS = 30_000;
const OTP_MAX_ATTEMPTS = 5;
const CITIES = new Set(['udaipur', 'kolkata']);

export function createApi({ store, sms, verifyGoogle, googleClientId = '', secureCookies = false }) {
  // Per IP is loose because a whole classroom can share one IP; per email/phone is the tight one.
  // On Netlify these live per function instance, so they are a speed bump, not a hard wall.
  const authLimit = rateLimiter({ windowMs: 15 * 60_000, max: 300 });
  const loginPerEmail = rateLimiter({ windowMs: 15 * 60_000, max: 10 });
  const otpPerPhone = rateLimiter({ windowMs: 60 * 60_000, max: 5 });

  const publicUser = (u) => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone, avatar: u.avatar,
    via: [u.password_hash && 'email', u.phone && 'phone', u.google_sub && 'google'].filter(Boolean),
    createdAt: u.created_at,
  });

  const cleanName = (n) => (typeof n === 'string' ? n.trim().replace(/\s+/g, ' ').slice(0, 60) : '');

  function sessionCookie(token, maxAgeMs) {
    return [`${COOKIE}=${encodeURIComponent(token)}`, 'Path=/', `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
      'HttpOnly', 'SameSite=Lax', secureCookies && 'Secure'].filter(Boolean).join('; ');
  }

  async function startSession(userId) {
    const token = newToken();
    await store.insertSession(sha256(token), userId, Date.now() + SESSION_DAYS * 86_400_000);
    await store.touchLogin(userId);
    return sessionCookie(token, SESSION_DAYS * 86_400_000);
  }

  function readToken(cookieHeader) {
    for (const part of (cookieHeader || '').split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === COOKIE) return decodeURIComponent(v.join('='));
    }
    return null;
  }

  const json = (status, body, cookie) => ({ status, body, cookies: cookie ? [cookie] : [] });
  const err = (status, error, extra) => json(status, { error, ...extra });
  const TOO_MANY = 'Too many attempts. Try again in a few minutes.';

  const routes = {
    // ---- config the browser needs ----
    'GET /api/config': async () => json(200, { googleClientId: googleClientId || null, smsMode: sms.mode }),

    // ---- email + password ----
    'POST /api/auth/signup': async ({ body, limited }) => {
      if (limited) return err(429, TOO_MANY);
      const name = cleanName(body?.name);
      const email = String(body?.email || '').trim().toLowerCase();
      const password = String(body?.password || '');
      if (!name) return err(400, 'Please tell us your name.');
      if (!isEmail(email)) return err(400, 'That email address does not look right.');
      if (password.length < 8) return err(400, 'Password needs at least 8 characters.');
      const existing = await store.userByEmail(email);
      if (existing?.password_hash) return err(409, 'An account with this email already exists. Log in instead.');
      if (existing) return err(409, 'This email signs in with Google. Use "Continue with Google".');
      const userId = await store.insertUser({ name, email, phone: null, google_sub: null, avatar: null, password_hash: hashPassword(password) });
      const cookie = await startSession(userId);
      return json(201, { user: publicUser(await store.userById(userId)) }, cookie);
    },

    'POST /api/auth/login': async ({ body, limited }) => {
      if (limited) return err(429, TOO_MANY);
      const email = String(body?.email || '').trim().toLowerCase();
      const password = String(body?.password || '');
      if (!loginPerEmail(email)) return err(429, 'Too many attempts for this email. Try again in 15 minutes.');
      const user = await store.userByEmail(email);
      if (!user || !verifyPassword(password, user.password_hash)) return err(401, 'Email or password is incorrect.');
      return json(200, { user: publicUser(user) }, await startSession(user.id));
    },

    // ---- phone + OTP ----
    'POST /api/auth/otp/request': async ({ body, limited }) => {
      if (limited) return err(429, TOO_MANY);
      const phone = normalizePhone(body?.phone);
      if (!phone) return err(400, 'Enter a valid mobile number, e.g. 98765 43210.');
      const prev = await store.getOtp(phone);
      if (prev && Date.now() - prev.sent_at < OTP_RESEND_MS) {
        const wait = Math.ceil((OTP_RESEND_MS - (Date.now() - prev.sent_at)) / 1000);
        return err(429, `Please wait ${wait}s before asking for a new code.`, { retryIn: wait });
      }
      if (!otpPerPhone(phone)) return err(429, 'Too many codes sent to this number. Try again in an hour.');
      const code = newOtp();
      try {
        await sms.send(phone, `${code} is your Virasat login code. It expires in 5 minutes.`);
      } catch (e) {
        console.error('[virasat] SMS failed:', e.message);
        return err(502, 'Could not send the SMS right now. Please try again.');
      }
      await store.putOtp(phone, sha256(phone + ':' + code), Date.now() + OTP_TTL_MS, Date.now());
      const out = { phone, isNew: !(await store.userByPhone(phone)), expiresIn: OTP_TTL_MS / 1000, resendIn: OTP_RESEND_MS / 1000 };
      if (sms.mode === 'demo') out.demoCode = code;
      return json(200, out);
    },

    'POST /api/auth/otp/verify': async ({ body, limited }) => {
      if (limited) return err(429, TOO_MANY);
      const phone = normalizePhone(body?.phone);
      const code = String(body?.code || '').replace(/\D/g, '');
      if (!phone || code.length !== 6) return err(400, 'Enter the 6-digit code.');
      const row = await store.getOtp(phone);
      if (!row || row.expires_at < Date.now()) return err(400, 'This code has expired. Ask for a new one.');
      if (row.attempts >= OTP_MAX_ATTEMPTS) return err(429, 'Too many wrong tries. Ask for a new code.');
      if (!safeEqualHex(sha256(phone + ':' + code), row.code_hash)) {
        await store.bumpOtp(phone);
        const left = OTP_MAX_ATTEMPTS - row.attempts - 1;
        return err(401, left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong code. Ask for a new one.');
      }
      await store.dropOtp(phone);
      let user = await store.userByPhone(phone);
      let created = false;
      if (!user) {
        const id = await store.insertUser({ name: cleanName(body?.name) || 'Explorer', email: null, phone, google_sub: null, avatar: null, password_hash: null });
        user = await store.userById(id);
        created = true;
      }
      return json(created ? 201 : 200, { user: publicUser(user) }, await startSession(user.id));
    },

    // ---- Google ----
    'POST /api/auth/google': async ({ body, limited }) => {
      if (limited) return err(429, TOO_MANY);
      const credential = body?.credential;
      if (typeof credential !== 'string' || !credential) return err(400, 'Missing Google credential.');
      let g;
      try {
        g = await verifyGoogle(credential);
      } catch (e) {
        return err(401, 'Google sign-in failed: ' + e.message);
      }
      let user = await store.userByGoogle(g.sub);
      if (!user && g.email) {
        const byEmail = await store.userByEmail(g.email);
        if (byEmail) {
          // Emails typed at sign-up are never verified, so whoever set that password may not own the
          // address. Google has verified it: hand the account to Google and drop the old password and sessions.
          await store.takeOverForGoogle(byEmail.id, g.sub, g.picture);
          user = await store.userById(byEmail.id);
        }
      }
      let created = false;
      if (!user) {
        const id = await store.insertUser({ name: cleanName(g.name) || 'Explorer', email: g.email, phone: null, google_sub: g.sub, avatar: g.picture, password_hash: null });
        user = await store.userById(id);
        created = true;
      }
      return json(created ? 201 : 200, { user: publicUser(user) }, await startSession(user.id));
    },

    // ---- session ----
    'GET /api/me': async ({ user }) => json(200, { user: user ? publicUser(user) : null }),

    'POST /api/auth/logout': async ({ token }) => {
      if (token) await store.deleteSession(sha256(token));
      return json(200, { ok: true }, `${COOKIE}=; Path=/; Max-Age=0`);
    },

    // ---- learning progress ----
    'POST /api/progress/visit': async ({ user, body }) => {
      if (!user) return err(401, 'Please log in first.');
      const city = String(body?.city || '');
      if (!CITIES.has(city)) return err(400, 'Unknown city.');
      await store.visit(user.id, city);
      return json(200, { ok: true });
    },

    'POST /api/progress/quiz': async ({ user, body }) => {
      if (!user) return err(401, 'Please log in first.');
      const city = String(body?.city || '');
      const score = Number(body?.score), total = Number(body?.total);
      if (!CITIES.has(city)) return err(400, 'Unknown city.');
      if (!Number.isInteger(total) || total < 1 || total > 50 || !Number.isInteger(score) || score < 0 || score > total) {
        return err(400, 'Bad score.');
      }
      await store.addQuiz(user.id, city, score, total);
      return json(201, { ok: true });
    },

    'GET /api/progress': async ({ user }) => {
      if (!user) return err(401, 'Please log in first.');
      return json(200, { visits: await store.visits(user.id), quizzes: await store.bestQuiz(user.id) });
    },
  };

  const AUTH_ROUTES = new Set(['POST /api/auth/signup', 'POST /api/auth/login', 'POST /api/auth/otp/request',
    'POST /api/auth/otp/verify', 'POST /api/auth/google']);

  // req: { method, path, body, cookieHeader, ip } → { status, body, cookies: [Set-Cookie values] }
  return async function handle({ method, path, body, cookieHeader, ip }) {
    const key = `${method} ${path.replace(/\/+$/, '')}`;
    const route = routes[key];
    if (!route) return err(404, 'Not found');
    const token = readToken(cookieHeader);
    const user = token ? await store.sessionUser(sha256(token), Date.now()) : null;
    const limited = AUTH_ROUTES.has(key) && !authLimit(ip || 'unknown');
    return route({ body, token, user, limited });
  };
}
