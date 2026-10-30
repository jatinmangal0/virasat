// Turns the API into a standard web handler: (Request) → Response.
// Vercel calls it through api/index.js; the browser's request and our reply are plain web objects.
export function toWebHandler(handle, { path = (req) => new URL(req.url).pathname, ip = () => '' } = {}) {
  return async (req) => {
    let body = null;
    if (req.method === 'POST' || req.method === 'PUT') {
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
        method: req.method, path: path(req), body,
        cookieHeader: req.headers.get('cookie'), ip: ip(req),
      });
      // public answers that are the same for everyone may sit on Vercel's CDN for a minute, so the database
      // (which sleeps when idle) is woken far less often; everything else is never cached
      const headers = new Headers({ 'cache-control': out.cache ? `public, max-age=0, s-maxage=${out.cache}, stale-while-revalidate=600` : 'no-store' });
      for (const c of out.cookies) headers.append('set-cookie', c);
      return Response.json(out.body, { status: out.status, headers });
    } catch (e) {
      console.error('[virasat] API error:', e);
      return Response.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
    }
  };
}
