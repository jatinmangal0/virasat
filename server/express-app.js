// Runs the API under Express on your own computer (server/dev.js) and in the tests.
// The live site does not use this file: Netlify calls the API through netlify/functions/api.mjs.
import express from 'express';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('./public', import.meta.url));

export function createExpressApp(handle) {
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
  app.use(express.static(publicDir, { extensions: ['html'] }));
  return app;
}
