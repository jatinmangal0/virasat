// Runs the API under Express on your own computer (server/dev.js) and in the tests.
// The live site does not use this file: Vercel calls the API through api/index.js.
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
      res.setHeader('Cache-Control', out.cache ? `public, max-age=0, s-maxage=${out.cache}` : 'no-store');
      res.status(out.status).json(out.body);
    } catch (e) {
      next(e);
    }
  });
  app.use(express.static(publicDir, { extensions: ['html'] }));
  // A city's own address (/udaipur) opens the home page, which then walks into that city. On Vercel,
  // scripts/build-pages.js writes a page for each city instead, with its own title and share card.
  app.get(/^\/[a-z-]+\/?$/, (req, res, next) => (req.path.startsWith('/api') ? next() : res.sendFile(publicDir + 'index.html')));
  app.use((req, res) => res.status(404).sendFile(publicDir + '404.html'));
  return app;
}
