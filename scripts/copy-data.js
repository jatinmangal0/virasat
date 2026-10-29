// One-off: copies every row from the old Netlify database into the new Neon one.
//   OLD_DATABASE_URL=postgres://...netlify... DATABASE_URL=postgres://...neon... npm run copy-data
// Run `npm run migrate` on Neon first so the tables exist. This empties the Neon tables, copies
// the old rows in (parents before children, so links between tables hold), and moves each id
// counter past the highest copied id. The old database is only read, never changed.
import pg from 'pg';
import { makePool } from '../server/lib/db.js';

if (!process.env.OLD_DATABASE_URL) throw new Error('OLD_DATABASE_URL is not set');
const from = new pg.Pool({ connectionString: process.env.OLD_DATABASE_URL, max: 1 });
const to = makePool();

const tablesIn = async (db) => (await db.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'`,
)).rows.map((r) => r.table_name);

try {
  const oldTables = new Set(await tablesIn(from));
  const tables = (await tablesIn(to)).filter((t) => oldTables.has(t));

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
    await c.query(`TRUNCATE ${order.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    for (const t of order) {
      const cols = (await c.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'`, [t])).rows;
      const oldCols = new Set((await from.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [t],
      )).rows.map((r) => r.column_name));
      const shared = cols.filter((col) => oldCols.has(col.column_name));
      const names = shared.map((col) => `"${col.column_name}"`).join(', ');
      const rows = (await from.query(`SELECT ${names} FROM "${t}"`)).rows;
      const sql = `INSERT INTO "${t}" (${names}) OVERRIDING SYSTEM VALUE VALUES (${shared.map((_, i) => '$' + (i + 1)).join(', ')})`;
      for (const row of rows) {
        // JSON columns must go in as text, or pg would turn a JSON array into a Postgres array.
        await c.query(sql, shared.map(({ column_name: n, data_type: ty }) =>
          (ty === 'json' || ty === 'jsonb') && row[n] != null ? JSON.stringify(row[n]) : row[n]));
      }
      // Move id counters (serial or identity) past the highest copied value.
      for (const { column_name: n } of shared) {
        const seq = (await c.query('SELECT pg_get_serial_sequence($1, $2) AS s', [`"${t}"`, n])).rows[0].s;
        if (seq) await c.query(`SELECT setval($1, COALESCE((SELECT MAX("${n}") FROM "${t}"), 0) + 1, false)`, [seq]);
      }
      console.log(`${t}: ${rows.length} rows`);
    }
    await c.query('COMMIT');
    console.log('Done. Every table on Neon now matches the old database.');
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
