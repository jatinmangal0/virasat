// Applies every file in db/migrations/ that has not run yet on the live database (Neon).
//   DATABASE_URL=postgres://... npm run migrate
// Each file runs once, in name order, inside a transaction. The names of the files that have run
// are kept in the schema_migrations table, so running this again only applies new ones.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makePool } from '../server/lib/db.js';

const dir = fileURLToPath(new URL('../db/migrations/', import.meta.url));

export async function migrate(db, log = console.log) {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const last = [...done].sort().at(-1);
  for (const f of files) {
    if (done.has(f)) continue;
    if (last && f < last) throw new Error(`${f} is dated before ${last}, which already ran. Give it a later timestamp.`);
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      await c.query(readFileSync(dir + f, 'utf8'));
      await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await c.query('COMMIT');
      log(`applied ${f}`);
    } catch (e) {
      await c.query('ROLLBACK');
      throw new Error(`${f} failed: ${e.message}`);
    } finally {
      c.release();
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Vercel runs this on every build. Preview builds share the live database, so only a
  // production build (a merge into main) may change its structure.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    console.log(`Skipping migrations on a ${process.env.VERCEL_ENV} build.`);
    process.exit(0);
  }
  const db = makePool();
  try {
    await migrate(db);
    console.log('Database is up to date.');
  } finally {
    await db.end();
  }
}
