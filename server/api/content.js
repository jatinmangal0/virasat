// What the public website shows. Only published cities, and only facts and quiz questions a
// teammate has verified. Quiz answers are never sent ahead: the browser asks /api/quiz/check.
import { json, err } from './router.js';

const publicEvent = (e) => ({ id: e.id, year: e.year_label, title: e.title, text: e.body, images: e.images, motif: e.motif, src: e.source_url,
  memory: e.memory, memorySrc: e.memory_source_url, argued: e.argued });

// The shape the website code expects for one city (the same shape the old content.js had).
export async function loadPublicCities(db) {
  const cities = (await db.query('SELECT * FROM cities WHERE published ORDER BY sort_order, id')).rows;
  const sections = (await db.query('SELECT * FROM sections ORDER BY sort_order, id')).rows;
  const facts = (await db.query(
    "SELECT id, section_id, title, body, source_url, image FROM facts WHERE status = 'verified' ORDER BY sort_order, id")).rows;
  const quiz = (await db.query(
    "SELECT id, city_id, question, options FROM quiz_questions WHERE status = 'verified' ORDER BY sort_order, id")).rows;
  const events = (await db.query(
    "SELECT id, city_id, year_label, title, body, images, motif, source_url, memory, memory_source_url, argued FROM timeline_events WHERE status = 'verified' AND NOT hidden ORDER BY sort_order, id")).rows;

  return cities.map((c) => ({
    id: c.id, name: c.name, native: c.native_name, state: c.state, nickname: c.nickname, accent: c.accent,
    stamp: c.stamp, poster: c.poster, greeting: c.greeting, greetingNote: c.greeting_note, from: c.from_line,
    letter: c.letter, quickFacts: c.quick_facts, sources: c.sources,
    sections: sections.filter((s) => s.city_id === c.id).map((s) => ({
      id: s.slug, label: s.label, icon: s.icon,
      items: facts.filter((f) => f.section_id === s.id).map((f) => ({ id: f.id, title: f.title, text: f.body, src: f.source_url, image: f.image })),
    })),
    quiz: quiz.filter((q) => q.city_id === c.id).map((q) => ({ id: q.id, q: q.question, options: q.options })),
    timeline: events.filter((e) => e.city_id === c.id).map(publicEvent),
    outline: c.outline, outlineSource: c.outline_source, water: c.water, waterSource: c.water_source, photos: c.photos,
  }));
}

export default function content(r, { db }) {
  r.get('/api/cities', { cache: 60 }, async () => json(200, { cities: await loadPublicCities(db) }));

  // For uptime checks: answers without touching the database, so it can stay asleep.
  r.get('/api/health', async () => json(200, { ok: true }));

  // The greetings that scroll in the top bar.
  r.get('/api/greetings', { cache: 60 }, async () => {
    const rows = (await db.query("SELECT word, native, language FROM greetings WHERE status = 'verified' ORDER BY sort_order, id")).rows;
    // An empty list is never kept on the CDN: otherwise the bar shows its fallback text for up to
    // ten minutes after the first greetings are verified.
    return { ...json(200, { greetings: rows }), noStore: rows.length === 0 };
  });

  // Demo mode (the website with ?demo in its address): everything that is written but not yet checked, so the
  // team can see the design full. The page labels every one as a draft. Editors only: unchecked text must never
  // reach the public, and draft quiz answers are included so the team can play the quiz.
  r.get('/api/demo', { role: 'editor' }, async () => {
    const events = (await db.query(
      "SELECT id, city_id, year_label, title, body, images, motif, source_url, memory, memory_source_url, argued FROM timeline_events WHERE status = 'needs_check' AND NOT hidden ORDER BY sort_order, id")).rows;
    const greetings = (await db.query("SELECT word, native, language FROM greetings WHERE status = 'needs_check' ORDER BY sort_order, id")).rows;
    const factRows = (await db.query(`SELECT f.id, f.title, f.body, f.source_url, f.image, s.city_id, s.slug FROM facts f
      JOIN sections s ON s.id = f.section_id WHERE f.status = 'needs_check' ORDER BY f.sort_order, f.id`)).rows;
    const quizRows = (await db.query(
      "SELECT id, city_id, question, options, answer_index FROM quiz_questions WHERE status = 'needs_check' ORDER BY sort_order, id")).rows;
    const placeRows = (await db.query(`SELECT id, city_id, name, native_name, category, subcategory, description,
        latitude, longitude, year, image_url, image_license, source_url FROM heritage_places
      WHERE status = 'needs_check' AND latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY sort_order, id`)).rows;
    const timeline = {}, places = {}, facts = {}, quiz = {};
    for (const e of events) (timeline[e.city_id] ||= []).push({ ...publicEvent(e), draft: true });
    for (const f of factRows) ((facts[f.city_id] ||= {})[f.slug] ||= []).push({ id: f.id, title: f.title, text: f.body, src: f.source_url, image: f.image, draft: true });
    for (const q of quizRows) (quiz[q.city_id] ||= []).push({ id: q.id, q: q.question, options: q.options, answer: q.answer_index, draft: true });
    for (const { city_id, ...p } of placeRows) (places[city_id] ||= []).push({ ...p, draft: true });
    return json(200, { timeline, greetings, places, facts, quiz });
  });

  // Check one answer while someone is playing, and show the right one so the page can teach. Works without
  // logging in. For a logged-in player the choice is recorded: their round is marked by the first choice on
  // each question (progress.js), so asking for the answer first cannot buy a perfect score.
  r.post('/api/quiz/check', async ({ body, user }) => {
    const id = Number(body.id), choice = Number(body.choice);
    if (!Number.isInteger(id) || !Number.isInteger(choice)) return err(400, 'Bad answer.');
    const q = (await db.query("SELECT answer_index FROM quiz_questions WHERE id = $1 AND status = 'verified'", [id])).rows[0];
    if (!q) return err(404, 'That question is not available.');
    if (user) await db.query('INSERT INTO quiz_checks (user_id, question_id, choice) VALUES ($1, $2, $3)', [user.id, id, choice]);
    return json(200, { correct: choice === q.answer_index, answer: q.answer_index });
  });
}
