// Signing up and logging in: email + password, phone + one-time code, or Google.
import { json, err, transaction } from './router.js';
import { startSession, clearSessionCookie, publicUser } from './session.js';
import {
  hashPassword, verifyPassword, sha256, newOtp, safeEqualHex, normalizePhone, isEmail, rateLimiter,
} from '../lib/security.js';

const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_MS = 30_000;
const OTP_MAX_ATTEMPTS = 5;

export const cleanName = (n) => (typeof n === 'string' ? n.trim().replace(/\s+/g, ' ').slice(0, 60) : '');

export default function auth(r, { db, sms, verifyGoogle, googleClientId, secureCookies, allowDemoSms = true, applyAdminList = async (u) => u }) {
  // Demo SMS hands the code back to whoever asked for it, so anyone could log in as any number.
  // That is fine on your own computer and in tests, never on the live site: there, phone login
  // stays switched off until real SMS (Twilio) is set up.
  const phoneOff = sms.mode === 'demo' && !allowDemoSms;
  const PHONE_OFF = 'Phone login is not switched on yet. Use your email for now.';
  const loginPerEmail = rateLimiter({ windowMs: 15 * 60_000, max: 10 });
  const otpPerPhone = rateLimiter({ windowMs: 60 * 60_000, max: 5 });
  const one = async (text, params) => (await db.query(text, params)).rows[0] || null;
  const userById = (id) => one('SELECT * FROM users WHERE id = $1', [id]);
  const insertUser = async (u) => (await one(
    `INSERT INTO users (name, email, phone, google_sub, avatar, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [u.name, u.email ?? null, u.phone ?? null, u.google_sub ?? null, u.avatar ?? null, u.password_hash ?? null])).id;
  const signedIn = async (status, userId) =>
    json(status, { user: publicUser(await userById(userId)) }, await startSession(db, userId, secureCookies));

  // ---- what the browser needs to know before anyone logs in ----
  r.get('/api/config', async () => json(200, { googleClientId: googleClientId || null, smsMode: phoneOff ? 'off' : sms.mode }));

  // ---- email + password ----
  r.post('/api/auth/signup', { limit: true }, async ({ body }) => {
    const name = cleanName(body.name);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!name) return err(400, 'Please tell us your name.');
    if (!isEmail(email)) return err(400, 'That email address does not look right.');
    if (password.length < 8) return err(400, 'Password needs at least 8 characters.');
    const existing = await one('SELECT * FROM users WHERE email = $1', [email]);
    if (existing?.password_hash) return err(409, 'An account with this email already exists. Log in instead.');
    if (existing) return err(409, 'This email signs in with Google. Use "Continue with Google".');
    return signedIn(201, await insertUser({ name, email, password_hash: hashPassword(password) }));
  });

  r.post('/api/auth/login', { limit: true }, async ({ body }) => {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!loginPerEmail(email)) return err(429, 'Too many attempts for this email. Try again in 15 minutes.');
    const user = await one('SELECT * FROM users WHERE email = $1', [email]);
    if (!user || !verifyPassword(password, user.password_hash)) return err(401, 'Email or password is incorrect.');
    return signedIn(200, user.id);
  });

  // ---- phone + one-time code ----
  r.post('/api/auth/otp/request', { limit: true }, async ({ body }) => {
    if (phoneOff) return err(503, PHONE_OFF);
    const phone = normalizePhone(body.phone);
    if (!phone) return err(400, 'Enter a valid mobile number, e.g. 98765 43210.');
    const prev = await one('SELECT sent_at FROM otps WHERE phone = $1', [phone]);
    const since = prev ? Date.now() - Number(prev.sent_at) : Infinity;
    if (since < OTP_RESEND_MS) {
      const wait = Math.ceil((OTP_RESEND_MS - since) / 1000);
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
    await db.query(
      `INSERT INTO otps (phone, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (phone) DO UPDATE SET code_hash = excluded.code_hash,
       expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`,
      [phone, sha256(phone + ':' + code), Date.now() + OTP_TTL_MS, Date.now()]);
    const out = { phone, isNew: !(await one('SELECT id FROM users WHERE phone = $1', [phone])), expiresIn: OTP_TTL_MS / 1000, resendIn: OTP_RESEND_MS / 1000 };
    if (sms.mode === 'demo') out.demoCode = code;
    return json(200, out);
  });

  r.post('/api/auth/otp/verify', { limit: true }, async ({ body }) => {
    if (phoneOff) return err(503, PHONE_OFF);
    const phone = normalizePhone(body.phone);
    const code = String(body.code || '').replace(/\D/g, '');
    if (!phone || code.length !== 6) return err(400, 'Enter the 6-digit code.');
    const row = await one('SELECT * FROM otps WHERE phone = $1', [phone]);
    if (!row || Number(row.expires_at) < Date.now()) return err(400, 'This code has expired. Ask for a new one.');
    if (row.attempts >= OTP_MAX_ATTEMPTS) return err(429, 'Too many wrong tries. Ask for a new code.');
    if (!safeEqualHex(sha256(phone + ':' + code), row.code_hash)) {
      await db.query('UPDATE otps SET attempts = attempts + 1 WHERE phone = $1', [phone]);
      const left = OTP_MAX_ATTEMPTS - row.attempts - 1;
      return err(401, left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong code. Ask for a new one.');
    }
    await db.query('DELETE FROM otps WHERE phone = $1', [phone]);
    const user = await one('SELECT id FROM users WHERE phone = $1', [phone]);
    if (user) return signedIn(200, user.id);
    return signedIn(201, await insertUser({ name: cleanName(body.name) || 'Explorer', phone }));
  });

  // ---- Google ----
  r.post('/api/auth/google', { limit: true }, async ({ body }) => {
    const credential = body.credential;
    if (typeof credential !== 'string' || !credential) return err(400, 'Missing Google credential.');
    let g;
    try {
      g = await verifyGoogle(credential);
    } catch (e) {
      return err(401, 'Google sign-in failed: ' + e.message);
    }
    let user = await one('SELECT * FROM users WHERE google_sub = $1', [g.sub]);
    if (!user && g.email) {
      const byEmail = await one('SELECT * FROM users WHERE email = $1', [g.email]);
      if (byEmail) {
        // Emails typed at sign-up are never verified, so whoever set that password may not own the
        // address. Google has verified it: hand the account to Google and drop the old password and sessions.
        await transaction(db, async (c) => {
          await c.query('UPDATE users SET google_sub = $1, avatar = COALESCE(avatar, $2), password_hash = NULL WHERE id = $3', [g.sub, g.picture, byEmail.id]);
          await c.query('DELETE FROM sessions WHERE user_id = $1', [byEmail.id]);
        });
        user = byEmail;
      }
    }
    const isNew = !user;
    const id = user ? user.id : await insertUser({ name: cleanName(g.name) || 'Explorer', email: g.email, google_sub: g.sub, avatar: g.picture });
    await applyAdminList(await userById(id)); // listed admin emails get the admin view from their first sign-in
    return signedIn(isNew ? 201 : 200, id);
  });

  // ---- session ----
  r.get('/api/me', async ({ user }) => json(200, { user: user ? publicUser(user) : null }));

  // Delete my account: the person, their sessions, progress, stamps, scores and class places all go
  // (the tables cascade). Content an editor wrote stays on the site without their name.
  r.post('/api/auth/delete-account', { limit: true }, async ({ user, body }) => {
    if (!user) return err(401, 'Please log in first.');
    if (body.confirm !== 'DELETE') return err(400, 'Type DELETE to confirm.');
    if (user.role === 'admin') {
      const admins = (await one("SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin'", [])).n;
      if (admins <= 1) return err(400, 'You are the only admin. Make someone else admin first.');
    }
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    return json(200, { ok: true }, clearSessionCookie);
  });

  r.post('/api/auth/logout', async ({ token }) => {
    if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
    return json(200, { ok: true }, clearSessionCookie);
  });
}
