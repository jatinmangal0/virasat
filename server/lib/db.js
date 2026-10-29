// The live database: a Postgres on Neon (neon.tech), reached through the DATABASE_URL setting.
// Neon requires an encrypted connection; the connection string carries sslmode=require for that.
import pg from 'pg';

export function makePool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  // Serverless functions start and stop often, so keep few connections and let idle ones go quickly.
  return new pg.Pool({ connectionString, max: 3, idleTimeoutMillis: 10_000 });
}
