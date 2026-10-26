import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApi } from './core.js';
import { sqliteStore } from './lib/store-sqlite.js';

const here = dirname(fileURLToPath(import.meta.url));

// Local server: the shared API (core.js) on SQLite, plus the static site.
// The live site runs the same API as a Netlify Function instead (netlify/functions/api.mjs).
export function createApp({ db, store = sqliteStore(db), sms, verifyGoogle, googleClientId = '', secureCookies = false }) {
  const handle = createApi({ store, sms, verifyGoogle, googleClientId, secureCookies });
  const app = express();
  app.disable('x-powered-by');

  app.use('/api', express.json({ limit: '20kb' }), async (req, res, next) => {
    try {
      const out = await handle({
        method: req.method, path: req.originalUrl.split('?')[0], body: req.body,
        cookieHeader: req.headers.cookie, ip: req.ip,
      });
      if (out.cookies.length) res.setHeader('Set-Cookie', out.cookies);
      res.status(out.status).json(out.body);
    } catch (e) {
      next(e);
    }
  });
  app.use(express.static(join(here, 'public'), { extensions: ['html'] }));
  return app;
}
