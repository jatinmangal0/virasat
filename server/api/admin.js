// The editor page (/admin). Editors write and check content; admins also manage the team.
//
// The team's rules, enforced here so no page or person can skip them:
//   - New and edited facts and quiz questions start as 'needs_check' and are hidden from the website.
//   - Verifying needs a source link, and must be done by someone other than the person who made the
//     latest change ("four eyes"). Imported content has no author, so any editor may verify it.
//   - Changing the words or source of a verified item puts it back to 'needs_check'.
//   - Every change is written to content_log with the before and after.
import { timingSafeEqual } from 'node:crypto';
import { json, err, transaction } from './router.js';
import { publicUser } from './session.js';

const ROLES = ['learner', 'editor', 'admin'];
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isUrl = (s) => /^https?:\/\/[^\s]+$/i.test(s);

export default function admin(r, { db, adminSetupCode }) {
  const one = async (sql, params, c = db) => (await c.query(sql, params)).rows[0] || null;
  const log = (c, userId, action, entity, id, before, after) => c.query(
    'INSERT INTO content_log (user_id, action, entity, entity_id, before, after) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, action, entity, String(id), before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]);

  // ---------------------------------------------------------------- overview
  r.get('/api/admin/cities', { role: 'editor' }, async () => {
    const rows = (await db.query(`
      SELECT c.id, c.name, c.published,
        (SELECT COUNT(*)::int FROM facts f JOIN sections s ON s.id = f.section_id WHERE s.city_id = c.id AND f.status = 'verified') AS facts_verified,
        (SELECT COUNT(*)::int FROM facts f JOIN sections s ON s.id = f.section_id WHERE s.city_id = c.id AND f.status = 'needs_check') AS facts_to_check,
        (SELECT COUNT(*)::int FROM quiz_questions q WHERE q.city_id = c.id AND q.status = 'verified') AS quiz_verified,
        (SELECT COUNT(*)::int FROM quiz_questions q WHERE q.city_id = c.id AND q.status = 'needs_check') AS quiz_to_check
      FROM cities c ORDER BY c.sort_order, c.id`)).rows;
    return json(200, { cities: rows });
  });

  // Everything about one city, including unchecked items and who did what.
  r.get('/api/admin/cities/:id', { role: 'editor' }, async ({ params }) => {
    const city = await one('SELECT * FROM cities WHERE id = $1', [params.id]);
    if (!city) return err(404, 'No such city.');
    const people = `LEFT JOIN users cu ON cu.id = x.created_by LEFT JOIN users uu ON uu.id = x.updated_by LEFT JOIN users vu ON vu.id = x.verified_by`;
    const names = 'cu.name AS created_by_name, uu.name AS updated_by_name, vu.name AS verified_by_name';
    const sections = (await db.query('SELECT id, slug, label, icon FROM sections WHERE city_id = $1 ORDER BY sort_order, id', [city.id])).rows;
    const facts = (await db.query(`SELECT x.*, ${names} FROM facts x ${people}
      WHERE x.section_id = ANY($1::int[]) ORDER BY x.sort_order, x.id`, [sections.map((s) => s.id)])).rows;
    const quiz = (await db.query(`SELECT x.*, ${names} FROM quiz_questions x ${people}
      WHERE x.city_id = $1 ORDER BY x.sort_order, x.id`, [city.id])).rows;
    return json(200, { city, sections: sections.map((s) => ({ ...s, facts: facts.filter((f) => f.section_id === s.id) })), quiz });
  });

  // ---------------------------------------------------------------- city profile (letter, quick facts)
  r.put('/api/admin/cities/:id', { role: 'editor' }, async ({ params, body, user }) => {
    const before = await one('SELECT * FROM cities WHERE id = $1', [params.id]);
    if (!before) return err(404, 'No such city.');
    const pairs = (v) => (Array.isArray(v) ? v : []).map((p) => [text(p?.[0], 120), text(p?.[1], 500)]).filter(([a, b]) => a && b).slice(0, 30);
    const next = {
      name: text(body.name, 60) || before.name, native_name: text(body.native, 60), state: text(body.state, 60),
      nickname: text(body.nickname, 80), greeting: text(body.greeting, 60), greeting_note: text(body.greetingNote, 120),
      from_line: text(body.from, 120),
      letter: (Array.isArray(body.letter) ? body.letter : []).map((p) => text(p, 2000)).filter(Boolean).slice(0, 10),
      quick_facts: pairs(body.quickFacts), sources: pairs(body.sources),
      published: user.role === 'admin' && typeof body.published === 'boolean' ? body.published : before.published,
    };
    const bad = next.sources.find(([, u]) => !isUrl(u));
    if (bad) return err(400, `The source "${bad[0]}" needs a link starting with http:// or https://.`);
    const after = await transaction(db, async (c) => {
      const row = await one(`UPDATE cities SET name = $2, native_name = $3, state = $4, nickname = $5, greeting = $6,
        greeting_note = $7, from_line = $8, letter = $9, quick_facts = $10, sources = $11, published = $12,
        updated_by = $13, updated_at = now() WHERE id = $1 RETURNING *`,
      [before.id, next.name, next.native_name, next.state, next.nickname, next.greeting, next.greeting_note, next.from_line,
        JSON.stringify(next.letter), JSON.stringify(next.quick_facts), JSON.stringify(next.sources), next.published, user.id], c);
      await log(c, user.id, 'update', 'city', before.id, before, row);
      return row;
    });
    return json(200, { city: after });
  });

  // ---------------------------------------------------------------- facts and quiz questions
  // Both follow the same life cycle, so one set of routes is built for each.
  const kinds = {
    fact: {
      table: 'facts', path: 'facts',
      read: async (b, c) => {
        const out = { title: text(b.title, 120), body: text(b.text, 1500), source_url: text(b.sourceUrl, 500), section_id: Number(b.sectionId) };
        if (!out.title || !out.body) return { error: 'A fact needs a title and some text.' };
        if (!(await one('SELECT 1 FROM sections WHERE id = $1', [out.section_id], c))) return { error: 'Pick a section.' };
        return out;
      },
      columns: ['section_id', 'title', 'body', 'source_url'],
      wording: ['title', 'body', 'source_url'],
    },
    quiz: {
      table: 'quiz_questions', path: 'quiz',
      read: async (b, c) => {
        const options = (Array.isArray(b.options) ? b.options : []).map((o) => text(o, 200)).filter(Boolean);
        const out = { question: text(b.question, 300), options, answer_index: Number(b.answerIndex), source_url: text(b.sourceUrl, 500), city_id: text(b.cityId, 40) };
        if (!out.question) return { error: 'Write the question.' };
        if (options.length < 2 || options.length > 6) return { error: 'Give between 2 and 6 options.' };
        if (!Number.isInteger(out.answer_index) || out.answer_index < 0 || out.answer_index >= options.length) return { error: 'Choose which option is right.' };
        if (!(await one('SELECT 1 FROM cities WHERE id = $1', [out.city_id], c))) return { error: 'Pick a city.' };
        return out;
      },
      columns: ['city_id', 'question', 'options', 'answer_index', 'source_url'],
      wording: ['question', 'options', 'answer_index', 'source_url'],
    },
    // Heritage places (from Aksh's workbooks): a point on the map with a short description.
    // Aksh's extra research columns stay in `details`; the editor page changes only these.
    place: {
      table: 'heritage_places', path: 'places',
      read: async (b, c) => {
        const coord = (v, max) => (v === '' || v == null ? null : Number.isFinite(Number(v)) && Math.abs(Number(v)) <= max ? Number(v) : NaN);
        const out = { city_id: text(b.cityId, 40), name: text(b.name, 160), subcategory: text(b.subcategory, 120),
          description: text(b.description, 1500), latitude: coord(b.latitude, 90), longitude: coord(b.longitude, 180),
          source_url: text(b.sourceUrl, 500) };
        if (!out.name) return { error: 'A place needs a name.' };
        if (Number.isNaN(out.latitude) || Number.isNaN(out.longitude)) return { error: 'Latitude and longitude must be numbers, like 24.5764 and 73.6835.' };
        if (!(await one('SELECT 1 FROM cities WHERE id = $1', [out.city_id], c))) return { error: 'Pick a city.' };
        return out;
      },
      columns: ['city_id', 'name', 'subcategory', 'description', 'latitude', 'longitude', 'source_url'],
      wording: ['name', 'subcategory', 'description', 'latitude', 'longitude', 'source_url'],
    },
  };

  for (const [entity, k] of Object.entries(kinds)) {
    const val = (row, col) => (col === 'options' ? JSON.stringify(row[col]) : row[col]);
    const same = (a, b, cols) => cols.every((col) => JSON.stringify(a[col]) === JSON.stringify(b[col]));
    const check = (out) => (out.source_url && !isUrl(out.source_url) ? 'The source must be a link starting with http:// or https://.' : null);

    r.post(`/api/admin/${k.path}`, { role: 'editor' }, async ({ body, user }) => {
      const out = await k.read(body, db);
      if (out.error || check(out)) return err(400, out.error || check(out));
      const row = await transaction(db, async (c) => {
        const cols = [...k.columns, 'created_by', 'updated_by', 'sort_order'];
        const vals = [...k.columns.map((col) => val(out, col)), user.id, user.id];
        const created = await one(`INSERT INTO ${k.table} (${cols.join(', ')})
          VALUES (${cols.slice(0, -1).map((_, i) => `$${i + 1}`).join(', ')}, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ${k.table}))
          RETURNING *`, vals, c);
        await log(c, user.id, 'create', entity, created.id, null, created);
        return created;
      });
      return json(201, { [entity]: row });
    });

    r.put(`/api/admin/${k.path}/:id`, { role: 'editor' }, async ({ params, body, user }) => {
      const before = await one(`SELECT * FROM ${k.table} WHERE id = $1`, [Number(params.id)]);
      if (!before) return err(404, 'Not found.');
      const out = await k.read(body, db);
      if (out.error || check(out)) return err(400, out.error || check(out));
      if (same(before, out, k.columns)) return json(200, { [entity]: before });
      const reword = !same(before, out, k.wording) && before.status === 'verified';
      const row = await transaction(db, async (c) => {
        const sets = k.columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
        const updated = await one(`UPDATE ${k.table} SET ${sets}, updated_by = $${k.columns.length + 2}, updated_at = now()
          ${reword ? ", status = 'needs_check', verified_by = NULL, verified_at = NULL" : ''}
          WHERE id = $1 RETURNING *`, [before.id, ...k.columns.map((col) => val(out, col)), user.id], c);
        await log(c, user.id, 'update', entity, before.id, before, updated);
        return updated;
      });
      return json(200, { [entity]: row, backToCheck: reword });
    });

    r.post(`/api/admin/${k.path}/:id/verify`, { role: 'editor' }, async ({ params, user }) => {
      const before = await one(`SELECT * FROM ${k.table} WHERE id = $1`, [Number(params.id)]);
      if (!before) return err(404, 'Not found.');
      if (before.status === 'verified') return json(200, { [entity]: before });
      if (!before.source_url) return err(400, 'Add a source link before verifying.');
      if (before.updated_by === user.id) {
        return err(403, 'You made the latest change to this, so a different teammate has to check and verify it.');
      }
      const row = await transaction(db, async (c) => {
        const updated = await one(`UPDATE ${k.table} SET status = 'verified', verified_by = $2, verified_at = now()
          WHERE id = $1 RETURNING *`, [before.id, user.id], c);
        await log(c, user.id, 'verify', entity, before.id, before, updated);
        return updated;
      });
      return json(200, { [entity]: row });
    });

    r.post(`/api/admin/${k.path}/:id/unverify`, { role: 'editor' }, async ({ params, user }) => {
      const before = await one(`SELECT * FROM ${k.table} WHERE id = $1`, [Number(params.id)]);
      if (!before) return err(404, 'Not found.');
      const row = await transaction(db, async (c) => {
        const updated = await one(`UPDATE ${k.table} SET status = 'needs_check', verified_by = NULL, verified_at = NULL
          WHERE id = $1 RETURNING *`, [before.id], c);
        await log(c, user.id, 'unverify', entity, before.id, before, updated);
        return updated;
      });
      return json(200, { [entity]: row });
    });

    r.delete(`/api/admin/${k.path}/:id`, { role: 'editor' }, async ({ params, user }) => {
      const before = await one(`SELECT * FROM ${k.table} WHERE id = $1`, [Number(params.id)]);
      if (!before) return err(404, 'Not found.');
      await transaction(db, async (c) => {
        await c.query(`DELETE FROM ${k.table} WHERE id = $1`, [before.id]);
        await log(c, user.id, 'delete', entity, before.id, before, null);
      });
      return json(200, { ok: true });
    });
  }

  // ---------------------------------------------------------------- history
  r.get('/api/admin/log', { role: 'editor' }, async () => {
    const rows = (await db.query(`SELECT l.id, l.action, l.entity, l.entity_id, l.at, u.name AS user_name,
      COALESCE(l.after->>'title', l.before->>'title', l.after->>'question', l.before->>'question', l.after->>'name', l.before->>'name') AS label
      FROM content_log l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.at DESC, l.id DESC LIMIT 200`)).rows;
    return json(200, { log: rows });
  });

  // ---------------------------------------------------------------- team
  r.get('/api/admin/users', { role: 'admin' }, async () => {
    const rows = (await db.query(`SELECT * FROM users ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, id LIMIT 500`)).rows;
    return json(200, { users: rows.map(publicUser) });
  });

  r.put('/api/admin/users/:id/role', { role: 'admin' }, async ({ params, body, user }) => {
    const role = String(body.role || '');
    if (!ROLES.includes(role)) return err(400, 'Role must be learner, editor or admin.');
    const target = await one('SELECT * FROM users WHERE id = $1', [Number(params.id)]);
    if (!target) return err(404, 'No such person.');
    if (target.id === user.id && role !== 'admin') {
      const admins = (await one("SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin'", [])).n;
      if (admins <= 1) return err(400, 'You are the only admin. Make someone else admin first.');
    }
    const row = await transaction(db, async (c) => {
      const updated = await one('UPDATE users SET role = $2 WHERE id = $1 RETURNING *', [target.id, role], c);
      await log(c, user.id, 'role', 'user', target.id, { name: target.name, role: target.role }, { name: target.name, role });
      return updated;
    });
    return json(200, { user: publicUser(row) });
  });

  // The very first admin: works only while there is no admin at all, and needs the setup code
  // stored in the ADMIN_SETUP_CODE environment variable on Vercel.
  r.post('/api/admin/claim', { role: 'learner', limit: true }, async ({ body, user }) => {
    const admins = (await one("SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin'", [])).n;
    if (admins > 0) return err(403, 'This site already has an admin. Ask them to give you a role.');
    const given = Buffer.from(String(body.code || '')), wanted = Buffer.from(adminSetupCode || '');
    if (!adminSetupCode || given.length !== wanted.length || !timingSafeEqual(given, wanted)) return err(403, 'That setup code is not right.');
    const row = await transaction(db, async (c) => {
      const updated = await one("UPDATE users SET role = 'admin' WHERE id = $1 RETURNING *", [user.id], c);
      await log(c, user.id, 'role', 'user', user.id, { name: user.name, role: user.role }, { name: user.name, role: 'admin' });
      return updated;
    });
    return json(200, { user: publicUser(row) });
  });
}
