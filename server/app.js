import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  hashPassword, verifyPassword, sha256, newToken, newOtp, safeEqualHex,
  normalizePhone, isEmail, rateLimiter,
} from './lib/security.js';

const here = dirname(fileURLToPath(import.meta.url));
const SESSION_DAYS = 30;
const COOKIE = 'virasat_sid';
const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_MS = 30_000;
const OTP_MAX_ATTEMPTS = 5;
const CITIES = new Set(['udaipur', 'kolkata']);

export function createApp({ db, sms, verifyGoogle, googleClientId = '', secureCookies = false }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));

  // Per IP is loose because a whole classroom can share one IP; per email/phone is the tight one.
  const authLimit = rateLimiter({ windowMs: 15 * 60_000, max: 300 });
  const loginPerEmail = rateLimiter({ windowMs: 15 * 60_000, max: 10 });
  const otpPerPhone = rateLimiter({ windowMs: 60 * 60_000, max: 5 });

  const q = {
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userByPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
    userByGoogle: db.prepare('SELECT * FROM users WHERE google_sub = ?'),
    insertUser: db.prepare(`INSERT INTO users (name, email, phone, google_sub, avatar, password_hash)
                            VALUES (@name, @email, @phone, @google_sub, @avatar, @password_hash)`),
    linkGoogle: db.prepare('UPDATE users SET google_sub = ?, avatar = COALESCE(avatar, ?) WHERE id = ?'),
    touchLogin: db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?"),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    sessionUser: db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                             WHERE s.token_hash = ? AND s.expires_at > ?`),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    getOtp: db.prepare('SELECT * FROM otps WHERE phone = ?'),
    putOtp: db.prepare(`INSERT INTO otps (phone, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
                        ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash,
                        expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`),
    bumpOtp: db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?'),
    dropOtp: db.prepare('DELETE FROM otps WHERE phone = ?'),
    visit: db.prepare(`INSERT INTO visits (user_id, city) VALUES (?, ?)
                       ON CONFLICT(user_id, city) DO UPDATE SET count = count + 1, last_at = datetime('now')`),
    visits: db.prepare('SELECT city, first_at, last_at, count FROM visits WHERE user_id = ?'),
    addQuiz: db.prepare('INSERT INTO quiz_results (user_id, city, score, total) VALUES (?, ?, ?, ?)'),
    bestQuiz: db.prepare(`SELECT city, MAX(score) AS best, total, COUNT(*) AS attempts
                          FROM quiz_results WHERE user_id = ? GROUP BY city`),
  };

  const publicUser = (u) => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone, avatar: u.avatar,
    via: [u.password_hash && 'email', u.phone && 'phone', u.google_sub && 'google'].filter(Boolean),
    createdAt: u.created_at,
  });

  function startSession(res, userId) {
    const token = newToken();
    q.insertSession.run(sha256(token), userId, Date.now() + SESSION_DAYS * 86_400_000);
    q.touchLogin.run(userId);
    res.cookie(COOKIE, token, {
      httpOnly: true, sameSite: 'lax', secure: secureCookies,
      maxAge: SESSION_DAYS * 86_400_000, path: '/',
    });
  }

  function readToken(req) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === COOKIE) return decodeURIComponent(v.join('='));
    }
    return null;
  }

  app.use((req, _res, next) => {
    const token = readToken(req);
    req.user = token ? q.sessionUser.get(sha256(token), Date.now()) || null : null;
    req.token = token;
    next();
  });

  const requireUser = (req, res, next) =>
    req.user ? next() : res.status(401).json({ error: 'Please log in first.' });

  const limited = (req, res, next) =>
    authLimit(req.ip) ? next() : res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });

  const cleanName = (n) => (typeof n === 'string' ? n.trim().replace(/\s+/g, ' ').slice(0, 60) : '');

  // ---- config the browser needs ----
  app.get('/api/config', (_req, res) => {
    res.json({ googleClientId: googleClientId || null, smsMode: sms.mode });
  });

  // ---- email + password ----
  app.post('/api/auth/signup', limited, (req, res) => {
    const name = cleanName(req.body?.name);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!name) return res.status(400).json({ error: 'Please tell us your name.' });
    if (!isEmail(email)) return res.status(400).json({ error: 'That email address does not look right.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password needs at least 8 characters.' });
    const existing = q.userByEmail.get(email);
    if (existing?.password_hash) return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
    if (existing) return res.status(409).json({ error: 'This email signs in with Google. Use "Continue with Google".' });
    const userId = q.insertUser.run({ name, email, phone: null, google_sub: null, avatar: null, password_hash: hashPassword(password) }).lastInsertRowid;
    startSession(res, userId);
    res.status(201).json({ user: publicUser(q.userById.get(userId)) });
  });

  app.post('/api/auth/login', limited, (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!loginPerEmail(email)) return res.status(429).json({ error: 'Too many attempts for this email. Try again in 15 minutes.' });
    const user = q.userByEmail.get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    startSession(res, user.id);
    res.json({ user: publicUser(user) });
  });

  // ---- phone + OTP ----
  app.post('/api/auth/otp/request', limited, async (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json({ error: 'Enter a valid mobile number, e.g. 98765 43210.' });
    const prev = q.getOtp.get(phone);
    if (prev && Date.now() - prev.sent_at < OTP_RESEND_MS) {
      const wait = Math.ceil((OTP_RESEND_MS - (Date.now() - prev.sent_at)) / 1000);
      return res.status(429).json({ error: `Please wait ${wait}s before asking for a new code.`, retryIn: wait });
    }
    if (!otpPerPhone(phone)) return res.status(429).json({ error: 'Too many codes sent to this number. Try again in an hour.' });
    const code = newOtp();
    try {
      await sms.send(phone, `${code} is your Virasat login code. It expires in 5 minutes.`);
    } catch (err) {
      console.error('[virasat] SMS failed:', err.message);
      return res.status(502).json({ error: 'Could not send the SMS right now. Please try again.' });
    }
    q.putOtp.run(phone, sha256(phone + ':' + code), Date.now() + OTP_TTL_MS, Date.now());
    const body = { phone, isNew: !q.userByPhone.get(phone), expiresIn: OTP_TTL_MS / 1000, resendIn: OTP_RESEND_MS / 1000 };
    if (sms.mode === 'demo') body.demoCode = code;
    res.json(body);
  });

  app.post('/api/auth/otp/verify', limited, (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code || '').replace(/\D/g, '');
    if (!phone || code.length !== 6) return res.status(400).json({ error: 'Enter the 6-digit code.' });
    const row = q.getOtp.get(phone);
    if (!row || row.expires_at < Date.now()) return res.status(400).json({ error: 'This code has expired. Ask for a new one.' });
    if (row.attempts >= OTP_MAX_ATTEMPTS) return res.status(429).json({ error: 'Too many wrong tries. Ask for a new code.' });
    if (!safeEqualHex(sha256(phone + ':' + code), row.code_hash)) {
      q.bumpOtp.run(phone);
      const left = OTP_MAX_ATTEMPTS - row.attempts - 1;
      return res.status(401).json({ error: left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong code. Ask for a new one.' });
    }
    q.dropOtp.run(phone);
    let user = q.userByPhone.get(phone);
    let created = false;
    if (!user) {
      const name = cleanName(req.body?.name) || 'Explorer';
      const id = q.insertUser.run({ name, email: null, phone, google_sub: null, avatar: null, password_hash: null }).lastInsertRowid;
      user = q.userById.get(id);
      created = true;
    }
    startSession(res, user.id);
    res.status(created ? 201 : 200).json({ user: publicUser(user) });
  });

  // ---- Google ----
  app.post('/api/auth/google', limited, async (req, res) => {
    const credential = req.body?.credential;
    if (typeof credential !== 'string' || !credential) return res.status(400).json({ error: 'Missing Google credential.' });
    let g;
    try {
      g = await verifyGoogle(credential);
    } catch (err) {
      return res.status(401).json({ error: 'Google sign-in failed: ' + err.message });
    }
    let user = q.userByGoogle.get(g.sub);
    if (!user && g.email) {
      const byEmail = q.userByEmail.get(g.email);
      if (byEmail) {
        // Emails typed at sign-up are never verified, so whoever set that password may not own the
        // address. Google has verified it: hand the account to Google and drop the old password and sessions.
        q.linkGoogle.run(g.sub, g.picture, byEmail.id);
        db.prepare('UPDATE users SET password_hash = NULL WHERE id = ?').run(byEmail.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(byEmail.id);
        user = q.userById.get(byEmail.id);
      }
    }
    let created = false;
    if (!user) {
      const id = q.insertUser.run({ name: cleanName(g.name) || 'Explorer', email: g.email, phone: null, google_sub: g.sub, avatar: g.picture, password_hash: null }).lastInsertRowid;
      user = q.userById.get(id);
      created = true;
    }
    startSession(res, user.id);
    res.status(created ? 201 : 200).json({ user: publicUser(user) });
  });

  // ---- session ----
  app.get('/api/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

  app.post('/api/auth/logout', (req, res) => {
    if (req.token) q.deleteSession.run(sha256(req.token));
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  // ---- learning progress ----
  app.post('/api/progress/visit', requireUser, (req, res) => {
    const city = String(req.body?.city || '');
    if (!CITIES.has(city)) return res.status(400).json({ error: 'Unknown city.' });
    q.visit.run(req.user.id, city);
    res.json({ ok: true });
  });

  app.post('/api/progress/quiz', requireUser, (req, res) => {
    const city = String(req.body?.city || '');
    const score = Number(req.body?.score), total = Number(req.body?.total);
    if (!CITIES.has(city)) return res.status(400).json({ error: 'Unknown city.' });
    if (!Number.isInteger(total) || total < 1 || total > 50 || !Number.isInteger(score) || score < 0 || score > total) {
      return res.status(400).json({ error: 'Bad score.' });
    }
    q.addQuiz.run(req.user.id, city, score, total);
    res.status(201).json({ ok: true });
  });

  app.get('/api/progress', requireUser, (req, res) => {
    res.json({ visits: q.visits.all(req.user.id), quizzes: q.bestQuiz.all(req.user.id) });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(express.static(join(here, 'public'), { extensions: ['html'] }));
  return app;
}
