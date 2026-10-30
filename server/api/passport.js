// The Fading Passport: stamps that fade until you remember the city again.
//
// Sealing a city's letter (3 in 5 or better, in progress.js) presses its stamp into your passport, in box 1.
// Each box has a waiting time. When it runs out the stamp starts to fade, and Gaju brings a three-question
// "memory letter". Two or more right: the stamp moves up a box and is re-inked. Fewer: back to box 1.
//
//   box 1 → due 2 days later    box 2 → 7 days    box 3 → 21 days    box 4 → kept for good
//
// This is the Leitner system, a simple way to space out practice so each recall comes just as you would
// start to forget. The three small functions below are the whole rule; the routes only store and serve it.
import { json, err } from './router.js';

const DAY = 24 * 60 * 60 * 1000;
export const BOX_DAYS = { 1: 2, 2: 7, 3: 21 };
export const KEPT = 4;
export const RECALL_SIZE = 3;
export const RECALL_POINTS = 15;

// Where a stamp goes after a recall.
export const nextBox = (box, passed) => (passed ? Math.min(box + 1, KEPT) : 1);

// When the next recall is due, or null once the stamp is kept for good.
export const dueAfter = (box, now) => (box >= KEPT ? null : new Date(now.getTime() + BOX_DAYS[box] * DAY));

// How strong the ink is, from 1 (fresh) down to 0.3: a little faded the moment it is due, then more each day.
export function inkOf(dueAt, now) {
  if (!dueAt) return 1;
  const late = (now - new Date(dueAt)) / DAY;
  if (late < 0) return 1;
  return Math.max(0.3, Math.round((0.85 - late * 0.1) * 100) / 100);
}

const view = (s, now) => ({
  city: s.city, box: s.box, earnedAt: s.earned_at, dueAt: s.due_at, recalledAt: s.recalled_at,
  due: !!s.due_at && new Date(s.due_at) <= now, ink: inkOf(s.due_at, now),
});

// Called from progress.js when a letter is sealed. Returns true when this pressed a new stamp.
export async function pressStamp(db, userId, city, now = new Date()) {
  const r = await db.query('INSERT INTO stamps (user_id, city, due_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [userId, city, dueAfter(1, now)]);
  return r.rowCount > 0;
}

export default function passport(r, { db }) {
  const stampOf = async (userId, city) =>
    (await db.query('SELECT * FROM stamps WHERE user_id = $1 AND city = $2', [userId, city])).rows[0] || null;

  r.get('/api/passport', { role: 'learner' }, async ({ user }) => {
    const now = new Date();
    const rows = (await db.query('SELECT * FROM stamps WHERE user_id = $1 ORDER BY earned_at', [user.id])).rows;
    return json(200, { stamps: rows.map((s) => view(s, now)) });
  });

  // The memory letter: a few of the city's checked questions, without their answers.
  r.get('/api/recall/:city', { role: 'learner' }, async ({ user, params }) => {
    const s = await stampOf(user.id, params.city);
    if (!s) return err(404, 'Seal this city\'s letter first to earn its stamp.');
    if (!view(s, new Date()).due) return err(409, 'This stamp is still fresh. Come back when it starts to fade.');
    const qs = (await db.query(`SELECT id, question, options FROM quiz_questions
      WHERE city_id = $1 AND status = 'verified' ORDER BY random() LIMIT $2`, [params.city, RECALL_SIZE])).rows;
    if (!qs.length) return err(400, 'This city has no checked questions yet.');
    return json(200, { city: params.city, questions: qs.map((q) => ({ id: q.id, q: q.question, options: q.options })) });
  });

  // body: { answers: [{ id, choice }] }. The server marks them and moves the stamp.
  r.post('/api/recall/:city', { role: 'learner' }, async ({ user, params, body }) => {
    const now = new Date();
    const s = await stampOf(user.id, params.city);
    if (!s) return err(404, 'Seal this city\'s letter first to earn its stamp.');
    if (!view(s, now).due) return err(409, 'This stamp is still fresh. Come back when it starts to fade.');
    if (!Array.isArray(body.answers)) return err(400, 'Bad answers.');
    const chosen = new Map(body.answers.slice(0, RECALL_SIZE).map((a) => [Number(a?.id), Number(a?.choice)]));
    const rows = (await db.query(`SELECT id, answer_index FROM quiz_questions
      WHERE city_id = $1 AND status = 'verified' AND id = ANY($2::int[])`, [params.city, [...chosen.keys()].filter(Number.isInteger)])).rows;
    if (!rows.length) return err(400, 'Answer the questions in the letter.');
    const right = rows.filter((q) => chosen.get(q.id) === q.answer_index).length;
    const passed = right >= Math.ceil(rows.length * 2 / 3);
    const box = nextBox(s.box, passed);
    // a passed recall can always be tried again tomorrow at the earliest, never right away
    const due = passed ? dueAfter(box, now) : new Date(now.getTime() + DAY);
    await db.query('UPDATE stamps SET box = $3, due_at = $4, recalled_at = $5 WHERE user_id = $1 AND city = $2',
      [user.id, params.city, box, due, now]);
    // each box pays once: reaching box 2, 3 and 4 is 15 points each
    let earned = 0;
    if (passed) {
      const res = await db.query('INSERT INTO points_ledger (user_id, points, reason, ref) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [user.id, RECALL_POINTS, 'recall', `${params.city}:box${box}`]);
      earned = res.rowCount * RECALL_POINTS;
    }
    const points = (await db.query('SELECT COALESCE(SUM(points), 0)::int AS n FROM points_ledger WHERE user_id = $1', [user.id])).rows[0].n;
    return json(200, { right, asked: rows.length, passed, box, dueAt: due, ink: inkOf(due, now), earned, points });
  });
}
