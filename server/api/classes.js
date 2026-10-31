// Classes: a teacher's class code, students who join with a nickname only, and what each student has done.
//
//   POST /api/classes                 start a class (any logged-in account), get its code
//   GET  /api/classes                 the classes you teach and the ones you are in, with their homework
//   POST /api/classes/join            join with { code, nickname }; without an account, this makes a class account
//   GET  /api/classes/:code/results   the teacher's view: each student's cities, best scores and stamps
//   POST /api/classes/:code/assign    the teacher sets a city as homework, with an optional due date
import { randomInt } from 'node:crypto';
import { json, err } from './router.js';
import { startSession } from './session.js';
import { cleanName } from './auth.js';

// Six letters and digits, leaving out the ones that look alike (0/O, 1/I/L).
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 6 }, () => LETTERS[randomInt(LETTERS.length)]).join('');
const codeOf = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export default function classes(r, { db, secureCookies }) {
  const one = async (sql, params) => (await db.query(sql, params)).rows[0] || null;
  const classByCode = (code) => one('SELECT * FROM classes WHERE code = $1', [codeOf(code)]);

  r.post('/api/classes', { role: 'learner', limit: true }, async ({ user, body }) => {
    const name = cleanName(body.name);
    if (name.length < 2) return err(400, 'Give the class a name, like "Class 8B Social Science".');
    for (let tries = 0; tries < 5; tries++) {
      const row = await one('INSERT INTO classes (code, name, teacher_id) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING RETURNING code, name',
        [newCode(), name, user.id]);
      if (row) return json(201, { class: row });
    }
    return err(500, 'Could not make a class code. Please try again.');
  });

  r.get('/api/classes', { role: 'learner' }, async ({ user }) => {
    const teaching = (await db.query(`SELECT c.code, c.name, (SELECT COUNT(*)::int FROM class_members m WHERE m.class_id = c.id) AS students
      FROM classes c WHERE c.teacher_id = $1 ORDER BY c.created_at`, [user.id])).rows;
    const member = (await db.query(`SELECT c.id, c.code, c.name, t.name AS teacher, m.nickname FROM class_members m
      JOIN classes c ON c.id = m.class_id JOIN users t ON t.id = c.teacher_id WHERE m.user_id = $1 ORDER BY m.joined_at`, [user.id])).rows;
    const work = (await db.query(`SELECT class_id, city, to_char(due_on, 'YYYY-MM-DD') AS due_on FROM assignments
      WHERE class_id = ANY($1::int[]) ORDER BY due_on NULLS LAST`, [member.map((m) => m.id)])).rows;
    return json(200, {
      teaching,
      member: member.map(({ id, ...m }) => ({ ...m, homework: work.filter((w) => w.class_id === id).map(({ city, due_on }) => ({ city, dueOn: due_on })) })),
    });
  });

  r.post('/api/classes/join', { limit: true }, async ({ user, body }) => {
    const c = await classByCode(body.code);
    if (!c) return err(404, 'No class has that code. Check it with your teacher.');
    if (user && c.teacher_id === user.id) return err(400, 'You teach this class.');
    if (user) {
      const nickname = cleanName(body.nickname) || user.name;
      const added = await db.query('INSERT INTO class_members (class_id, user_id, nickname) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [c.id, user.id, nickname]);
      // nothing added: either already in the class (fine) or the name is taken by someone else
      if (!added.rowCount && !(await one('SELECT 1 FROM class_members WHERE class_id = $1 AND user_id = $2', [c.id, user.id]))) {
        return err(409, 'Someone in this class already uses that name. Add an initial, like "Riya S".');
      }
      return json(200, { class: { code: c.code, name: c.name } });
    }
    // No account: a class account with just the nickname. It lives on this device (the login cookie).
    const nickname = cleanName(body.nickname);
    if (nickname.length < 2) return err(400, 'Type the name your teacher will know you by.');
    if (await one('SELECT 1 FROM class_members WHERE class_id = $1 AND lower(nickname) = lower($2)', [c.id, nickname])) {
      return err(409, 'Someone in this class already uses that name. Add an initial, like "Riya S".');
    }
    const u = await one('INSERT INTO users (name) VALUES ($1) RETURNING *', [nickname]);
    await db.query('INSERT INTO class_members (class_id, user_id, nickname) VALUES ($1, $2, $3)', [c.id, u.id, nickname]);
    const cookie = await startSession(db, u.id, secureCookies);
    return json(201, { class: { code: c.code, name: c.name }, user: { id: u.id, name: u.name, role: u.role, via: [] } }, cookie);
  });

  // Only the class's teacher may see results.
  const teacherOf = async (user, code) => {
    const c = await classByCode(code);
    if (!c) return [null, err(404, 'No class has that code.')];
    if (c.teacher_id !== user.id) return [null, err(403, 'Only the teacher of this class can see this.')];
    return [c, null];
  };

  r.get('/api/classes/:code/results', { role: 'learner' }, async ({ user, params }) => {
    const [c, no] = await teacherOf(user, params.code);
    if (no) return no;
    const students = (await db.query('SELECT user_id, nickname, joined_at FROM class_members WHERE class_id = $1 ORDER BY nickname', [c.id])).rows;
    const ids = students.map((s) => s.user_id);
    const [visits, quizzes, stamps, read, homework] = await Promise.all([
      db.query('SELECT user_id, city, count FROM visits WHERE user_id = ANY($1::int[])', [ids]),
      db.query('SELECT user_id, city, MAX(score) AS best, MAX(total) AS total FROM quiz_results WHERE user_id = ANY($1::int[]) GROUP BY user_id, city', [ids]),
      db.query('SELECT user_id, city, box FROM stamps WHERE user_id = ANY($1::int[])', [ids]),
      db.query(`SELECT c.user_id, s.city_id AS city, COUNT(*)::int AS n FROM covered_sections c JOIN sections s ON s.id = c.section_id
        WHERE c.user_id = ANY($1::int[]) GROUP BY c.user_id, s.city_id`, [ids]),
      db.query("SELECT id, city, to_char(due_on, 'YYYY-MM-DD') AS due_on FROM assignments WHERE class_id = $1 ORDER BY due_on NULLS LAST", [c.id]),
    ]);
    const pick = (rows, uid, city) => rows.rows.find((x) => x.user_id === uid && x.city === city);
    const cities = (await db.query('SELECT id, name FROM cities WHERE published ORDER BY sort_order, id')).rows;
    return json(200, {
      class: { code: c.code, name: c.name }, cities,
      homework: homework.rows.map((h) => ({ id: h.id, city: h.city, dueOn: h.due_on })),
      students: students.map((s) => ({
        name: s.nickname, joinedAt: s.joined_at,
        cities: Object.fromEntries(cities.map(({ id }) => [id, {
          opened: pick(visits, s.user_id, id)?.count || 0,
          read: pick(read, s.user_id, id)?.n || 0,
          best: pick(quizzes, s.user_id, id) ? { score: Number(pick(quizzes, s.user_id, id).best), total: Number(pick(quizzes, s.user_id, id).total) } : null,
          stamp: pick(stamps, s.user_id, id)?.box || 0,
        }])),
      })),
    });
  });

  r.post('/api/classes/:code/assign', { role: 'learner' }, async ({ user, params, body }) => {
    const [c, no] = await teacherOf(user, params.code);
    if (no) return no;
    const city = String(body.city || '');
    if (!(await one('SELECT 1 FROM cities WHERE id = $1 AND published', [city]))) return err(400, 'Pick a city.');
    const due = /^\d{4}-\d{2}-\d{2}$/.test(body.dueOn || '') ? body.dueOn : null;
    await db.query(`INSERT INTO assignments (class_id, city, due_on) VALUES ($1, $2, $3)
      ON CONFLICT (class_id, city) DO UPDATE SET due_on = excluded.due_on`, [c.id, city, due]);
    return json(200, { ok: true });
  });
}
