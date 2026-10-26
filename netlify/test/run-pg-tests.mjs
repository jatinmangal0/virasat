// Runs server/test/auth.test.js against a local Postgres engine with the real migrations applied,
// to check the Postgres storage the live site uses. Usage: npm run test:pg
import { NetlifyDB } from '@netlify/database-dev';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const db = new NetlifyDB();
const url = await db.start();
await db.applyMigrations(root + 'netlify/database/migrations');
// Not spawnSync: the database runs in this process and must keep answering while the tests run.
const child = spawn(process.execPath, ['test/auth.test.js'], {
  cwd: root + 'server', stdio: 'inherit', env: { ...process.env, VIRASAT_TEST_PG_URL: url },
});
const code = await new Promise((resolve) => child.on('exit', resolve));
await db.stop();
process.exit(code ?? 1);
