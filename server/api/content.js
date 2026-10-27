// What the public website shows. Only published cities, and only facts and quiz questions a
// teammate has verified. Quiz answers are never sent ahead: the browser asks /api/quiz/check.
import { json, err } from './router.js';

// The shape the website code expects for one city (the same shape the old content.js had).
export async function loadPublicCities(db) {
  const cities = (await db.query('SELECT * FROM cities WHERE published ORDER BY sort_order, id')).rows;
  const sections = (await db.query('SELECT * FROM sections ORDER BY sort_order, id')).rows;
  const facts = (await db.query(
    "SELECT id, section_id, title, body, source_url FROM facts WHERE status = 'verified' ORDER BY sort_order, id")).rows;
  const quiz = (await db.query(
    "SELECT id, city_id, question, options FROM quiz_questions WHERE status = 'verified' ORDER BY sort_order, id")).rows;
  const events = (await db.query(
    "SELECT id, city_id, year_label, title, body, images, source_url FROM timeline_events WHERE status = 'verified' ORDER BY sort_order, id")).rows;

  return cities.map((c) => ({
    id: c.id, name: c.name, native: c.native_name, state: c.state, nickname: c.nickname, accent: c.accent,
    stamp: c.stamp, poster: c.poster, greeting: c.greeting, greetingNote: c.greeting_note, from: c.from_line,
    letter: c.letter, quickFacts: c.quick_facts, sources: c.sources,
    sections: sections.filter((s) => s.city_id === c.id).map((s) => ({
      id: s.slug, label: s.label, icon: s.icon,
      items: facts.filter((f) => f.section_id === s.id).map((f) => ({ id: f.id, title: f.title, text: f.body, src: f.source_url })),
    })),
    quiz: quiz.filter((q) => q.city_id === c.id).map((q) => ({ id: q.id, q: q.question, options: q.options })),
    timeline: events.filter((e) => e.city_id === c.id).map((e) => ({ id: e.id, year: e.year_label, title: e.title, text: e.body, images: e.images, src: e.source_url })),
    outline: c.outline, outlineSource: c.outline_source,
  }));
}

export default function content(r, { db }) {
  r.get('/api/cities', async () => json(200, { cities: await loadPublicCities(db) }));

  // The greetings that scroll in the top bar.
  r.get('/api/greetings', async () => {
    const rows = (await db.query("SELECT word, native, language FROM greetings WHERE status = 'verified' ORDER BY sort_order, id")).rows;
    return json(200, { greetings: rows });
  });

  // Check one answer while someone is playing. Works without logging in.
  r.post('/api/quiz/check', async ({ body }) => {
    const id = Number(body.id), choice = Number(body.choice);
    if (!Number.isInteger(id) || !Number.isInteger(choice)) return err(400, 'Bad answer.');
    const q = (await db.query("SELECT answer_index FROM quiz_questions WHERE id = $1 AND status = 'verified'", [id])).rows[0];
    if (!q) return err(404, 'That question is not available.');
    return json(200, { correct: choice === q.answer_index, answer: q.answer_index });
  });
}
