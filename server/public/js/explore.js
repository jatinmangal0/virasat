// A city's Explore page, at its own address (/kolkata/explore). It opens from the end of the timeline, or
// straight from a shared link. Today it holds the map of the city's heritage places; flashcards and games
// will be more tabs here.
//
// The map: the city's outline drawn as a marigold thread that inks itself in, its lakes and river, and the
// team's heritage places as pins (places.js does the pins, the list and each place's card).
import { $ } from './lib.js';
import { initPlaces, loadPlaces, placePins } from './places.js';

let ctx;          // what app.js shares: state, CITIES, esc, onClose
let run = null;   // the open page: { id, c, places, story: { outline, g, place } }

export function initExplore(shared) {
  ctx = shared;
  initPlaces({ ctx, cur: () => run, relayout: () => layout() });
  addEventListener('resize', () => { if (run) layout(); });
}

export const exploreIsOpen = () => !!run;

export function openExplore(id, { fromCity = false } = {}) {
  const { CITIES, esc } = ctx, c = CITIES[id];
  if (!c) return;
  run = { id, c, places: [], story: { outline: null, g: { mob: innerWidth < 720 }, place: null } };
  const page = $('#explore');
  page.style.setProperty('--accent', c.accent);
  page.innerHTML = `
    <header class="ex-top">
      <button class="post-back" id="exBack">← ${fromCity ? `Back to ${esc(c.name)}'s letter` : 'Back to the street'}</button>
      <div class="ex-title"><small>Virasat Dak · Explore</small><h1 id="exTitle">${esc(c.name)}${c.native ? ` <span class="native">${esc(c.native)}</span>` : ''}</h1></div>
      <nav class="ex-tabs" aria-label="Explore ${esc(c.name)}">
        <button class="ex-tab on" aria-current="page">Map</button>
        <button class="ex-tab" disabled>Flashcards <i>soon</i></button>
        <button class="ex-tab" disabled>Games <i>soon</i></button>
      </nav>
    </header>
    <section class="ex-map-wrap" aria-label="Map of ${esc(c.name)}'s heritage places">
      <div class="place-legend" id="placeLegend"></div>
      <div class="ex-grid">
        <div class="ex-map" id="exMap">
          <svg class="ex-svg" id="exSvg" aria-hidden="true"></svg>
          <div class="places" id="places"></div>
          <aside class="place-list" id="placeList" hidden></aside>
        </div>
        <aside class="place-card" id="placeCard" aria-live="polite" hidden></aside>
      </div>
      <p class="ex-note" id="mapNote">Loading ${esc(c.name)}'s heritage places…</p>
      ${c.outlineSource ? `<p class="ex-src">City outline: ${esc(c.outlineSource.replace(/: https?:\/\/\S+$/, ''))}${c.waterSource ? ` · ${esc(c.waterSource)}` : ''}</p>` : ''}
    </section>`;
  page.hidden = false;
  page.scrollTop = 0;
  document.body.classList.add('locked');
  $('#exBack').addEventListener('click', () => ctx.onClose());
  requestAnimationFrame(() => {
    layout(true);
    loadPlaces(run).then(() => { if (run && !run.places.length) $('#mapNote').textContent = `${c.name}'s places are still being checked. Each one appears here once a second editor has checked its source.`; });
    page.focus({ preventScroll: true });
  });
}

export function closeExplore() {
  if (!run) return;
  run = null;
  const page = $('#explore');
  page.hidden = true;
  page.innerHTML = '';
  if ($('#city').hidden) document.body.classList.remove('locked');
}

// Fit the outline (and its water) into the map box, draw it, and put the pins where they belong.
function layout(first = false) {
  const box = $('#exMap');
  if (!run || !box) return;
  const W = box.clientWidth, H = box.clientHeight, c = run.c;
  const water = c.water || {};
  const wet = [...(water.areas || []).flatMap((a) => a.ring), ...(water.lines || []).flatMap((l) => l.line)];
  const ring = c.outline || [];
  const all = [...ring, ...wet];
  run.story.g = { mob: innerWidth < 720, W, H };
  if (all.length < 3) { $('#exSvg').innerHTML = ''; run.story.outline = null; return; }
  const lat0 = all.reduce((a, p) => a + p[1], 0) / all.length, k = Math.cos((lat0 * Math.PI) / 180);
  const xs = all.map((p) => p[0] * k), ys = all.map((p) => -p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), bw = Math.max(...xs) - minX, bh = Math.max(...ys) - minY;
  const pad = 0.08, sc = Math.min((W * (1 - 2 * pad)) / bw, (H * (1 - 2 * pad)) / bh);
  const ox = (W - bw * sc) / 2 - minX * sc, oy = (H - bh * sc) / 2 - minY * sc;
  const toXY = (lng, lat) => [lng * k * sc + ox, -lat * sc + oy];
  const project = (lng, lat) => {
    const x = lng * k, y = -lat;
    if (x < minX - bw * 0.1 || x > minX + bw * 1.1 || y < minY - bh * 0.1 || y > minY + bh * 1.1) return null;
    return toXY(lng, lat);
  };
  run.story.outline = { project, toXY };
  const P = (list) => list.map(([lng, lat]) => toXY(lng, lat).map((v) => v.toFixed(1)).join(',')).join(' ');
  const esc = ctx.esc;
  const svg = $('#exSvg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs><pattern id="exGrid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#f6ead214" stroke-width="1"/></pattern></defs>
    <rect width="${W}" height="${H}" fill="url(#exGrid)"/>
    ${ring.length > 2 ? `<polygon class="ex-land" points="${P(ring)}"/>` : ''}
    ${(water.areas || []).map((a) => `<polygon class="lake" points="${P(a.ring)}"><title>${esc(a.name)}</title></polygon>`).join('')}
    ${(water.lines || []).map((l) => `<polyline class="river" points="${P(l.line)}"><title>${esc(l.name)}</title></polyline>`).join('')}
    ${ring.length > 2 ? `<polygon class="ex-edge" points="${P(ring)}" pathLength="1000"/>` : ''}
    ${[...(water.areas || []).filter((a) => a.ring.length > 40), ...(water.lines || [])].map((w) => {
      const pts = (w.ring || w.line).map(([lng, lat]) => toXY(lng, lat));
      const [x, y] = pts[Math.floor(pts.length / (w.ring ? 2.6 : 2))];
      return `<text class="water-name" x="${x.toFixed(0)}" y="${y.toFixed(0)}">${esc(w.name)}</text>`;
    }).join('')}`;
  if (first) svg.classList.add('inking');
  placePins();
  // pins rise once the edge has inked itself in
  setTimeout(() => $('#places')?.classList.add('on'), first ? 1400 : 0);
}

