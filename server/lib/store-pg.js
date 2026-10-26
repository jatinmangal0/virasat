// Postgres storage for the live site (Netlify Database). Same async interface as store-sqlite.js.
// `pool` is a pg.Pool. The schema lives in netlify/database/migrations/.
// Big integers (epoch-ms times, counts) come back from pg as strings, so they are turned into numbers here.
const num = (row, ...keys) => {
  if (row) for (const k of keys) if (row[k] != null) row[k] = Number(row[k]);
  return row;
};

export function pgStore(pool) {
  const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
  const run = async (text, params) => { await pool.query(text, params); };

  return {
    userById: (id) => one('SELECT * FROM users WHERE id = $1', [id]),
    userByEmail: (email) => one('SELECT * FROM users WHERE email = $1', [email]),
    userByPhone: (phone) => one('SELECT * FROM users WHERE phone = $1', [phone]),
    userByGoogle: (sub) => one('SELECT * FROM users WHERE google_sub = $1', [sub]),
    insertUser: async (u) => (await one(
      `INSERT INTO users (name, email, phone, google_sub, avatar, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [u.name, u.email, u.phone, u.google_sub, u.avatar, u.password_hash])).id,
    takeOverForGoogle: async (id, sub, picture) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE users SET google_sub = $1, avatar = COALESCE(avatar, $2), password_hash = NULL WHERE id = $3', [sub, picture, id]);
        await client.query('DELETE FROM sessions WHERE user_id = $1', [id]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
    touchLogin: (id) => run("UPDATE users SET last_login_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE id = $1", [id]),
    insertSession: (hash, userId, expiresAt) => run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [hash, userId, expiresAt]),
    sessionUser: (hash, now) => one(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                                     WHERE s.token_hash = $1 AND s.expires_at > $2`, [hash, now]),
    deleteSession: (hash) => run('DELETE FROM sessions WHERE token_hash = $1', [hash]),
    getOtp: async (phone) => num(await one('SELECT * FROM otps WHERE phone = $1', [phone]), 'expires_at', 'sent_at', 'attempts'),
    putOtp: (phone, hash, expiresAt, sentAt) => run(
      `INSERT INTO otps (phone, code_hash, expires_at, attempts, sent_at) VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (phone) DO UPDATE SET code_hash = excluded.code_hash,
       expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`, [phone, hash, expiresAt, sentAt]),
    bumpOtp: (phone) => run('UPDATE otps SET attempts = attempts + 1 WHERE phone = $1', [phone]),
    dropOtp: (phone) => run('DELETE FROM otps WHERE phone = $1', [phone]),
    visit: (userId, city) => run(
      `INSERT INTO visits (user_id, city) VALUES ($1, $2)
       ON CONFLICT (user_id, city) DO UPDATE SET count = visits.count + 1,
       last_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`, [userId, city]),
    visits: async (userId) => (await pool.query('SELECT city, first_at, last_at, count FROM visits WHERE user_id = $1', [userId])).rows,
    addQuiz: (userId, city, score, total) => run('INSERT INTO quiz_results (user_id, city, score, total) VALUES ($1, $2, $3, $4)', [userId, city, score, total]),
    bestQuiz: async (userId) => (await pool.query(
      `SELECT city, MAX(score) AS best, (array_agg(total ORDER BY score DESC))[1] AS total, COUNT(*)::int AS attempts
       FROM quiz_results WHERE user_id = $1 GROUP BY city`, [userId])).rows,
  };
}
