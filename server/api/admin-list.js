// The admin email list: anyone who signs in with Google using a listed address is an admin.
//
// The list is the admin_emails table plus the ADMIN_EMAILS setting (comma-separated). Only accounts that
// signed in with Google count, because Google has checked that the person owns the address. An email
// typed at sign-up is never checked, so a password account with a listed address stays a learner until
// its owner signs in with Google (which also takes the account over and drops the old password).
//
// The role is written to the database, so the Team tab shows them as admin and every role check on the
// server sees it. Removing an address from the list does not demote anyone: change their role on the Team tab.

const clean = (e) => String(e || '').trim().toLowerCase();

export function makeAdminList({ db, adminEmails = '', ttlMs = 60_000 }) {
  const fromEnv = new Set(String(adminEmails).split(/[,\s;]+/).map(clean).filter(Boolean));
  let cached = null, cachedAt = 0;

  async function listed(email) {
    if (!email) return false;
    if (fromEnv.has(email)) return true;
    if (!cached || Date.now() - cachedAt >= ttlMs) {
      cached = new Set((await db.query('SELECT email FROM admin_emails')).rows.map((r) => clean(r.email)));
      cachedAt = Date.now();
    }
    return cached.has(email);
  }

  // Returns the user, made admin if their Google-checked email is on the list.
  return async function applyAdminList(user) {
    if (!user || user.role === 'admin' || !user.google_sub || !user.email) return user;
    if (!(await listed(clean(user.email)))) return user;
    const row = (await db.query("UPDATE users SET role = 'admin' WHERE id = $1 RETURNING *", [user.id])).rows[0];
    await db.query(
      'INSERT INTO content_log (user_id, action, entity, entity_id, before, after) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, 'role', 'user', String(user.id), JSON.stringify({ name: user.name, role: user.role }),
        JSON.stringify({ name: user.name, role: 'admin', why: 'admin email list' })]);
    return row || user;
  };
}
