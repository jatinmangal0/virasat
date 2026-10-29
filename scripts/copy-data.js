// One-off: copies every row from the old Netlify database into the new Neon one.
//   OLD_DATABASE_URL=postgres://...netlify... DATABASE_URL=postgres://...neon... npm run copy-data
// Run `npm run migrate` on Neon first so the tables exist. This empties the Neon tables, copies
// the old rows in (parents before children, so links between tables hold), and moves each id
// counter past the highest copied id. The old database is only read, never changed.
// Tables and columns that only Neon has (added by newer migrations, e.g. the timeline and the city
// outlines) keep the values the migrations gave them.
//
// With --once (how Vercel's production build runs it), it does nothing when OLD_DATABASE_URL is
// not set or the copy has already happened, so later builds never overwrite live data.
import pg from 'pg';
import { makePool } from '../server/lib/db.js';

const once = process.argv.includes('--once');
if (once && process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') process.exit(0);
if (!process.env.OLD_DATABASE_URL) {
  if (once) process.exit(0);
  throw new Error('OLD_DATABASE_URL is not set');
}
const from = new pg.Pool({ connectionString: process.env.OLD_DATABASE_URL, max: 1 });
const to = makePool();
await to.query('CREATE TABLE IF NOT EXISTS data_imports (name TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())');
if (once && (await to.query("SELECT 1 FROM data_imports WHERE name = 'netlify'")).rowCount) {
  console.log('Data was already copied from Netlify; skipping.');
  await Promise.all([from.end(), to.end()]);
  process.exit(0);
}

const tablesIn = async (db) => (await db.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ('schema_migrations', 'data_imports')`,
)).rows.map((r) => r.table_name);

try {
  const oldTables = new Set(await tablesIn(from));
  const tables = await tablesIn(to);

  // Order the tables so each one comes after the tables it points to.
  const deps = new Map(tables.map((t) => [t, new Set()]));
  for (const { child, parent } of (await to.query(
    `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
     FROM pg_constraint c WHERE c.contype = 'f'`)).rows) {
    if (deps.has(child) && deps.has(parent) && child !== parent) deps.get(child).add(parent);
  }
  const order = [];
  const visit = (t) => { if (order.includes(t)) return; for (const p of deps.get(t)) visit(p); order.push(t); };
  tables.forEach(visit);

  const c = await to.connect();
  try {
    await c.query('BEGIN');
    // Rows of Neon-only tables, set aside so emptying their parent tables doesn't lose them.
    const keep = new Map();
    for (const t of order.filter((t) => !oldTables.has(t))) keep.set(t, (await c.query(`SELECT * FROM "${t}"`)).rows);
    const before = new Map();
    for (const t of order.filter((t) => oldTables.has(t))) before.set(t, (await c.query(`SELECT * FROM "${t}"`)).rows);
    await c.query(`TRUNCATE ${order.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    for (const t of order) {
      const cols = (await c.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'`, [t])).rows;
      const oldCols = keep.has(t) ? null : new Set((await from.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [t],
      )).rows.map((r) => r.column_name));
      const shared = oldCols ? cols.filter((col) => oldCols.has(col.column_name)) : cols;
      const names = shared.map((col) => `"${col.column_name}"`).join(', ');
      const rows = keep.get(t) ?? (await from.query(`SELECT ${names} FROM "${t}"`)).rows;
      const sql = `INSERT INTO "${t}" (${names}) OVERRIDING SYSTEM VALUE VALUES (${shared.map((_, i) => '$' + (i + 1)).join(', ')})`;
      for (const row of rows) {
        // JSON columns must go in as text, or pg would turn a JSON array into a Postgres array.
        await c.query(sql, shared.map(({ column_name: n, data_type: ty }) =>
          (ty === 'json' || ty === 'jsonb') && row[n] != null ? JSON.stringify(row[n]) : row[n]));
      }
      // Neon-only columns of a copied table: put back the values the migrations set, matched by primary key.
      const extra = oldCols ? cols.filter((col) => !oldCols.has(col.column_name)) : [];
      if (extra.length) {
        const pk = (await c.query(
          `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
           WHERE i.indrelid = $1::regclass AND i.indisprimary`, [`"${t}"`])).rows.map((r) => r.attname);
        const set = extra.map((col, i) => `"${col.column_name}" = $${i + 1}`).join(', ');
        const where = pk.map((k, i) => `"${k}" = $${extra.length + i + 1}`).join(' AND ');
        for (const row of before.get(t)) {
          await c.query(`UPDATE "${t}" SET ${set} WHERE ${where}`, [
            ...extra.map(({ column_name: n, data_type: ty }) =>
              (ty === 'json' || ty === 'jsonb') && row[n] != null ? JSON.stringify(row[n]) : row[n]),
            ...pk.map((k) => row[k]),
          ]);
        }
      }
      // Move id counters (serial or identity) past the highest copied value.
      for (const { column_name: n } of shared) {
        const seq = (await c.query('SELECT pg_get_serial_sequence($1, $2) AS s', [`"${t}"`, n])).rows[0].s;
        if (seq) await c.query(`SELECT setval($1, COALESCE((SELECT MAX("${n}") FROM "${t}"), 0) + 1, false)`, [seq]);
      }
      console.log(`${t}: ${rows.length} rows${keep.has(t) ? ' (kept, not in the old database)' : ''}`);
    }
    await c.query("INSERT INTO data_imports (name) VALUES ('netlify') ON CONFLICT DO NOTHING");
    await c.query('COMMIT');
    console.log('Done. Neon now has every row from the old database.');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
} finally {
  await from.end();
  await to.end();
}
