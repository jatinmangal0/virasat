// A very small router: matches "GET /api/cities/:id" style patterns and hands back the params.

export function createRouter() {
  const routes = [];
  const add = (method) => (pattern, opts, fn) => {
    if (typeof opts === 'function') [fn, opts] = [opts, {}];
    const names = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    // cache: seconds the CDN may keep the answer (only for public answers that are the same for everyone)
    routes.push({ method, re, names, fn, role: opts.role || null, limit: !!opts.limit, cache: opts.cache || 0 });
  };
  return {
    get: add('GET'), post: add('POST'), put: add('PUT'), delete: add('DELETE'),
    find(method, path) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(path);
        if (m) return { route: r, params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
      }
      return null;
    },
  };
}

// What every route returns: an HTTP status, a JSON body, and any cookies to set.
export const json = (status, body, cookie) => ({ status, body, cookies: cookie ? [cookie] : [] });
export const err = (status, error, extra) => json(status, { error, ...extra });

// Run several queries as one all-or-nothing change.
export async function transaction(db, work) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const out = await work(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
