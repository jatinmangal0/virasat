// The Virasat API. Every request from the browser to /api/... ends up here.
//
// It has no web framework attached, so the same code runs on Netlify (netlify/functions/api.mjs)
// and on your own computer (server/dev.js). `db` is a Postgres connection pool.
//
// Each area lives in its own file and adds its routes to the router:
//   auth.js      signing up, logging in, sessions
//   content.js   cities, facts and quiz questions the public website shows
//   progress.js  what a learner has covered, quiz scores, points
//   admin.js     the editor page: writing, checking and verifying content, team roles
//   places.js    heritage places (map positions), public and editor lists
import { createRouter, err } from './router.js';
import { sha256, rateLimiter } from '../lib/security.js';
import { readSessionToken } from './session.js';
import auth from './auth.js';
import content from './content.js';
import progress from './progress.js';
import admin from './admin.js';
import places from './places.js';

export function createApi({ db, sms, verifyGoogle, googleClientId = '', secureCookies = false, adminSetupCode = '' }) {
  const deps = { db, sms, verifyGoogle, googleClientId, secureCookies, adminSetupCode };
  const router = createRouter();
  for (const area of [auth, content, progress, admin, places]) area(router, deps);

  // Per IP is loose because a whole classroom can share one IP; auth.js adds tighter per-email/phone limits.
  // On Netlify these counters live per function instance, so they are a speed bump, not a hard wall.
  const ipLimit = rateLimiter({ windowMs: 15 * 60_000, max: 300 });
  const ROLE_RANK = { learner: 1, editor: 2, admin: 3 };

  // req: { method, path, body, cookieHeader, ip } → { status, body, cookies: [Set-Cookie values] }
  return async function handle({ method, path, body, cookieHeader, ip }) {
    const match = router.find(method, path.replace(/\/+$/, ''));
    if (!match) return err(404, 'Not found');
    const { route, params } = match;

    const token = readSessionToken(cookieHeader);
    const user = token ? (await db.query(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > $2`, [sha256(token), Date.now()])).rows[0] || null : null;

    if (route.limit && !ipLimit(ip || 'unknown')) return err(429, 'Too many attempts. Try again in a few minutes.');
    if (route.role) {
      if (!user) return err(401, 'Please log in first.');
      if (ROLE_RANK[user.role] < ROLE_RANK[route.role]) {
        return err(403, route.role === 'admin' ? 'Only an admin can do this.' : 'Only team editors can do this.');
      }
    }
    return route.fn({ params, body: body ?? {}, user, token, ip });
  };
}
