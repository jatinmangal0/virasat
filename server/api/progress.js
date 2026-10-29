// A learner's journey: cities opened, sections read, quiz scores, and points.
//
// Points are awarded here on the server, never by the browser, so nobody can give themselves points.
// Each award is one row in points_ledger. The (user, reason, ref) pair is unique, so each thing pays once:
//   opening a city for the first time      10 points   ref 'udaipur'
//   reading a section for the first time    5 points   ref 'section:<id>'
//   each correct answer on your best quiz   10 points   ref 'udaipur:<n>' for the n-th correct answer
//   (and sealing a letter, 3 in 5 or better, presses the city's stamp into the passport: see passport.js)
// Beating your best score earns only the difference; retaking a quiz you've already aced earns nothing.
import { json, err } from './router.js';
import { pressStamp } from './passport.js';

export const POINTS = { cityVisit: 10, sectionRead: 5, quizAnswer: 10 };

export default function progress(r, { db }) {
  const cityExists = async (id) => (await db.query('SELECT 1 FROM cities WHERE id = $1 AND published', [String(id || '')])).rowCount > 0;

  // Returns the points this call added.
  async function award(userId, reason, refs, points) {
    let added = 0;
    for (const ref of refs) {
      const res = await db.query(
        'INSERT INTO points_ledger (user_id, points, reason, ref) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [userId, points, reason, ref]);
      added += res.rowCount * points;
    }
    return added;
  }
  const totalPoints = async (userId) =>
    (await db.query('SELECT COALESCE(SUM(points), 0)::int AS n FROM points_ledger WHERE user_id = $1', [userId])).rows[0].n;

  r.post('/api/progress/visit', { role: 'learner' }, async ({ user, body }) => {
    if (!(await cityExists(body.city))) return err(400, 'Unknown city.');
    await db.query(
      `INSERT INTO visits (user_id, city) VALUES ($1, $2)
       ON CONFLICT (user_id, city) DO UPDATE SET count = visits.count + 1,
       last_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`, [user.id, body.city]);
    const earned = await award(user.id, 'city_visit', [body.city], POINTS.cityVisit);
    return json(200, { earned, points: await totalPoints(user.id) });
  });

  r.post('/api/progress/section', { role: 'learner' }, async ({ user, body }) => {
    const s = (await db.query('SELECT id FROM sections WHERE city_id = $1 AND slug = $2', [String(body.city || ''), String(body.section || '')])).rows[0];
    if (!s) return err(400, 'Unknown section.');
    await db.query('INSERT INTO covered_sections (user_id, section_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, s.id]);
    const earned = await award(user.id, 'section_read', [`section:${s.id}`], POINTS.sectionRead);
    return json(200, { earned, points: await totalPoints(user.id) });
  });

  // body: { city, answers: [{ id, choice }] }. The server marks the answers itself.
  r.post('/api/progress/quiz', { role: 'learner' }, async ({ user, body }) => {
    const city = String(body.city || '');
    if (!(await cityExists(city))) return err(400, 'Unknown city.');
    if (!Array.isArray(body.answers) || body.answers.length > 100) return err(400, 'Bad answers.');
    const questions = (await db.query(
      "SELECT id, answer_index FROM quiz_questions WHERE city_id = $1 AND status = 'verified'", [city])).rows;
    if (!questions.length) return err(400, 'This city has no quiz yet.');
    const chosen = new Map(body.answers.map((a) => [Number(a?.id), Number(a?.choice)]));
    // The website asks up to five of the city's questions at a time, so a round is marked out of the
    // questions actually answered.
    const asked = questions.filter((q) => chosen.has(q.id));
    const score = asked.filter((q) => chosen.get(q.id) === q.answer_index).length;
    const total = asked.length || questions.length;
    await db.query('INSERT INTO quiz_results (user_id, city, score, total) VALUES ($1, $2, $3, $4)', [user.id, city, score, total]);
    const refs = Array.from({ length: score }, (_, i) => `${city}:${i + 1}`);
    const earned = await award(user.id, 'quiz_best', refs, POINTS.quizAnswer);
    const stamp = asked.length >= 3 && score / asked.length >= 0.6 ? await pressStamp(db, user.id, city) : false;
    return json(201, { score, total, earned, stamp, points: await totalPoints(user.id) });
  });

  r.get('/api/progress', { role: 'learner' }, async ({ user }) => {
    const [visits, quizzes, covered, history] = await Promise.all([
      db.query('SELECT city, first_at, last_at, count FROM visits WHERE user_id = $1', [user.id]),
      db.query(`SELECT city, MAX(score) AS best, (array_agg(total ORDER BY score DESC))[1] AS total, COUNT(*)::int AS attempts
                FROM quiz_results WHERE user_id = $1 GROUP BY city`, [user.id]),
      db.query(`SELECT s.city_id AS city, s.slug AS section FROM covered_sections c
                JOIN sections s ON s.id = c.section_id WHERE c.user_id = $1`, [user.id]),
      db.query('SELECT points, reason, ref, at FROM points_ledger WHERE user_id = $1 ORDER BY at DESC, id DESC LIMIT 20', [user.id]),
    ]);
    return json(200, {
      visits: visits.rows, quizzes: quizzes.rows, covered: covered.rows,
      points: await totalPoints(user.id), history: history.rows,
    });
  });
}
