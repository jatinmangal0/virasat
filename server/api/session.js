// Login sessions: a random token in an HttpOnly cookie, stored in the database only as a hash.
import { sha256, newToken } from '../lib/security.js';

export const COOKIE = 'virasat_sid';
const SESSION_DAYS = 30;

export function readSessionToken(cookieHeader) {
  for (const part of (cookieHeader || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Creates a session for the user and returns the Set-Cookie value.
export async function startSession(db, userId, secureCookies) {
  const token = newToken();
  const maxAge = SESSION_DAYS * 86_400_000;
  await db.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [sha256(token), userId, Date.now() + maxAge]);
  await db.query("UPDATE users SET last_login_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE id = $1", [userId]);
  return [`${COOKIE}=${encodeURIComponent(token)}`, 'Path=/', `Max-Age=${Math.floor(maxAge / 1000)}`,
    'HttpOnly', 'SameSite=Lax', secureCookies && 'Secure'].filter(Boolean).join('; ');
}

export const clearSessionCookie = `${COOKIE}=; Path=/; Max-Age=0`;

// What the browser is allowed to know about a user.
export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, avatar: u.avatar, role: u.role,
  via: [u.password_hash && 'email', u.phone && 'phone', u.google_sub && 'google'].filter(Boolean),
  createdAt: u.created_at,
});
