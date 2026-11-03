// What the flashcards and games are made of: the city's checked facts (by section), its full checked
// history, and its heritage places. Everything here comes from the database through the public API, so a
// new fact or event an editor checks turns up in the cards and games by itself.
import { fit } from './lib.js';
import { photoOf } from './places.js';

export const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
export const pick = (list, n) => shuffle(list).slice(0, n);

// One card per fact and per event: { id, deck, deckLabel, icon, title, text, year?, img?, credit?, src?, motif? }
export function cardsOf(run) {
  const { c } = run;
  const facts = c.sections.flatMap((s) => s.items.map((f) => ({
    id: `f${f.id}`, deck: s.id, deckLabel: s.label, icon: s.icon, title: f.title, text: f.text, src: f.src,
    img: f.image?.src ? fit(f.image.src, 720) : null, credit: f.image?.credit || '', page: f.image?.page || '',
  })));
  const history = (run.history || []).map((e) => ({
    id: `e${e.id}`, deck: 'history', deckLabel: 'History', icon: '⏳', title: e.title, text: e.text, src: e.src, year: e.year,
    img: e.images?.[0]?.src ? fit(e.images[0].src, 720) : null, credit: e.images?.[0]?.caption || '', motif: e.motif, major: e.major,
  }));
  return [...facts, ...history];
}

// The decks, in the order the city's letter uses, with History last.
export function decksOf(run, cards) {
  const decks = run.c.sections.map((s) => ({ id: s.id, label: s.label, icon: s.icon }));
  decks.push({ id: 'history', label: 'History', icon: '⏳' });
  return decks.map((d) => ({ ...d, n: cards.filter((x) => x.deck === d.id).length })).filter((d) => d.n);
}

// Heritage places that the team has written about, with a photo when there is one.
export function toldPlaces(run) {
  return run.places.filter((p) => p.description && Number.isFinite(p.latitude)).map((p) => ({ ...p, photo: photoOf(p.image_url, p.image_original) }));
}

// A year label ("1553", "c. 1536", "1620s") as a number, for putting events in order.
export const yearNum = (label) => parseInt(String(label).replace(/[^\d]/g, ' ').trim(), 10) || 0;

// Small per-visitor memory (learned cards, best scores). The page works the same without it.
export function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(`virasat.${key}`) || 'null');
    localStorage.setItem(`virasat.${key}`, JSON.stringify(value));
  } catch { /* private window or storage off */ }
  return value ?? null;
}
