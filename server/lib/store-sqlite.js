// SQLite storage for local runs and tests. Same async interface as store-pg.js.
export function sqliteStore(db) {
  const q = {
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userByPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
    userByGoogle: db.prepare('SELECT * FROM users WHERE google_sub = ?'),
    insertUser: db.prepare(`INSERT INTO users (name, email, phone, google_sub, avatar, password_hash)
                            VALUES (@name, @email, @phone, @google_sub, @avatar, @password_hash)`),
    linkGoogle: db.prepare('UPDATE users SET google_sub = ?, avatar = COALESCE(avatar, ?), password_hash = NULL WHERE id = ?'),
    dropSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    touchLogin: db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?"),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    sessionUser: db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                             WHERE s.token_hash = ? AND s.expires_at > ?`),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    getOtp: db.prepare('SELECT * FROM otps WHERE phone = ?'),
    putOtp: db.prepare(`INSERT INTO otps (phone, code_hash, expires_at, attempts, sent_at) VALUES (?, ?, ?, 0, ?)
                        ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash,
                        expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at`),
    bumpOtp: db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?'),
    dropOtp: db.prepare('DELETE FROM otps WHERE phone = ?'),
    visit: db.prepare(`INSERT INTO visits (user_id, city) VALUES (?, ?)
                       ON CONFLICT(user_id, city) DO UPDATE SET count = count + 1, last_at = datetime('now')`),
    visits: db.prepare('SELECT city, first_at, last_at, count FROM visits WHERE user_id = ?'),
    addQuiz: db.prepare('INSERT INTO quiz_results (user_id, city, score, total) VALUES (?, ?, ?, ?)'),
    bestQuiz: db.prepare(`SELECT city, MAX(score) AS best, total, COUNT(*) AS attempts
                          FROM quiz_results WHERE user_id = ? GROUP BY city`),
  };
  const takeOver = db.transaction((id, sub, picture) => { q.linkGoogle.run(sub, picture, id); q.dropSessions.run(id); });

  return {
    userById: async (id) => q.userById.get(id) || null,
    userByEmail: async (email) => q.userByEmail.get(email) || null,
    userByPhone: async (phone) => q.userByPhone.get(phone) || null,
    userByGoogle: async (sub) => q.userByGoogle.get(sub) || null,
    insertUser: async (u) => Number(q.insertUser.run(u).lastInsertRowid),
    takeOverForGoogle: async (id, sub, picture) => takeOver(id, sub, picture),
    touchLogin: async (id) => { q.touchLogin.run(id); },
    insertSession: async (hash, userId, expiresAt) => { q.insertSession.run(hash, userId, expiresAt); },
    sessionUser: async (hash, now) => q.sessionUser.get(hash, now) || null,
    deleteSession: async (hash) => { q.deleteSession.run(hash); },
    getOtp: async (phone) => q.getOtp.get(phone) || null,
    putOtp: async (phone, hash, expiresAt, sentAt) => { q.putOtp.run(phone, hash, expiresAt, sentAt); },
    bumpOtp: async (phone) => { q.bumpOtp.run(phone); },
    dropOtp: async (phone) => { q.dropOtp.run(phone); },
    visit: async (userId, city) => { q.visit.run(userId, city); },
    visits: async (userId) => q.visits.all(userId),
    addQuiz: async (userId, city, score, total) => { q.addQuiz.run(userId, city, score, total); },
    bestQuiz: async (userId) => q.bestQuiz.all(userId),
  };
}
