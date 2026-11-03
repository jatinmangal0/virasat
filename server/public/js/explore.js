// A city's Explore page, at its own address (/kolkata/explore). It opens from the end of the timeline, or
// straight from a shared link. Three tabs: the Map of the city's heritage places, Flashcards to learn the
// city's facts and history, and Games built from the same checked content (/kolkata/explore#cards, #games).
//
// The map: the city's outline drawn as a marigold thread that inks itself in, its lakes and river, and the
// team's heritage places as pins (places.js does the pins, the list and each place's card). It zooms (wheel,
// pinch, the + and − buttons) and pans (drag), and a search box finds any place by name.
import { $, $$, clamp, reduced } from './lib.js';
import { initPlaces, loadPlaces, placePins, showPlace, isBare } from './places.js';
import { fitCity, cityMapSVG } from './citymap.js';
import { renderCards } from './explore-cards.js';
import { renderGames } from './explore-games.js';

let ctx;          // what app.js shares: state, CITIES, esc, sound, onClose
let run = null;   // the open page: { id, c, places, history, tab, view, story: { outline, g, place } }

const TABS = [['map', 'Map'], ['cards', 'Flashcards'], ['games', 'Games']];
const MAX_ZOOM = 8;

export function initExplore(shared) {
  ctx = shared;
  initPlaces({ ctx, cur: () => run, relayout: () => layout() });
  addEventListener('resize', () => { if (run?.tab === 'map') layout(); run?.onResize?.(); });
}

export const exploreIsOpen = () => !!run;

export function openExplore(id, { fromCity = false } = {}) {
  const { CITIES, esc } = ctx, c = CITIES[id];
  if (!c) return;
  const tab = TABS.some(([t]) => `#${t}` === location.hash) ? location.hash.slice(1) : 'map';
  run = { id, c, places: [], history: null, tab: null, view: { z: 1, x: 0.5, y: 0.5 }, story: { outline: null, g: { mob: innerWidth < 720 }, place: null } };
  const page = $('#explore');
  page.style.setProperty('--accent', c.accent);
  page.innerHTML = `
    <header class="ex-top">
      <button class="post-back" id="exBack">← ${fromCity ? `Back to ${esc(c.name)}'s letter` : 'Back to the street'}</button>
      <div class="ex-title"><small>Virasat Dak · Explore</small><h1 id="exTitle">${esc(c.name)}${c.native ? ` <span class="native">${esc(c.native)}</span>` : ''}</h1></div>
      <nav class="ex-tabs" role="tablist" aria-label="Explore ${esc(c.name)}">
        ${TABS.map(([t, label]) => `<button class="ex-tab" role="tab" id="exTab-${t}" data-tab="${t}" aria-controls="exPanel-${t}">${label}</button>`).join('')}
      </nav>
    </header>
    <section class="ex-panel ex-map-wrap" id="exPanel-map" role="tabpanel" aria-labelledby="exTab-map" hidden>
      <div class="ex-tools">
        <div class="ex-search" role="search">
          <input id="exFind" type="search" placeholder="Find a place in ${esc(c.name)}…" autocomplete="off" aria-label="Find a place" aria-controls="exFound" aria-expanded="false">
          <ul class="ex-found" id="exFound" role="listbox" hidden></ul>
        </div>
        <button class="chip ex-surprise" id="exSurprise" type="button">✦ Surprise me</button>
      </div>
      <div class="place-legend" id="placeLegend"></div>
      <div class="ex-grid">
        <div class="ex-map" id="exMap">
          <div class="ex-stage" id="exStage">
            <svg class="ex-svg" id="exSvg" aria-hidden="true"></svg>
            <div class="places" id="places"></div>
          </div>
          <div class="ex-zoom" aria-label="Zoom the map">
            <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
            <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
            <button type="button" data-zoom="reset" aria-label="Show the whole city" title="Whole city">⤢</button>
          </div>
          <p class="ex-hint" id="exHint">Drag to move · pinch or scroll to zoom</p>
          <aside class="place-list" id="placeList" hidden></aside>
        </div>
        <aside class="place-card" id="placeCard" aria-live="polite" hidden></aside>
      </div>
      <p class="ex-note" id="mapNote">Loading ${esc(c.name)}'s heritage places…</p>
      ${c.outlineSource ? `<p class="ex-src">City outline: ${esc(c.outlineSource.replace(/: https?:\/\/\S+$/, ''))}${c.waterSource ? ` · ${esc(c.waterSource)}` : ''}</p>` : ''}
    </section>
    <section class="ex-panel ex-cards-wrap" id="exPanel-cards" role="tabpanel" aria-labelledby="exTab-cards" hidden></section>
    <section class="ex-panel ex-games-wrap" id="exPanel-games" role="tabpanel" aria-labelledby="exTab-games" hidden></section>`;
  page.hidden = false;
  page.scrollTop = 0;
  document.body.classList.add('locked');
  $('#exBack').addEventListener('click', () => ctx.onClose());
  $$('.ex-tab', page).forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab, true)));
  $('.ex-tabs', page).addEventListener('keydown', (e) => {
    const i = TABS.findIndex(([t]) => t === run.tab), d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const next = TABS[(i + d + TABS.length) % TABS.length][0];
    showTab(next, true);
    $(`#exTab-${next}`).focus();
  });
  setupMapControls();
  const me = run;
  // the places and the full history are fetched once; the flashcards and games wait for them
  run.ready = Promise.all([
    loadPlaces(run).then(() => { if (run === me && !run.places.length) $('#mapNote').textContent = `${c.name}'s places are still being checked. Each one appears here once a second editor has checked its source.`; }),
    ctx.api(`/api/cities/${id}/history`).then((r) => { me.history = r.ok && r.data.events.length ? r.data.events : c.timeline.map((e) => ({ ...e, major: true })); }),
  ]);
  requestAnimationFrame(() => {
    showTab(tab, false);
    page.focus({ preventScroll: true });
  });
}

export function closeExplore() {
  if (!run) return;
  run.onLeave?.();
  run = null;
  const page = $('#explore');
  page.hidden = true;
  page.innerHTML = '';
  if ($('#city').hidden) document.body.classList.remove('locked');
}

// The tabs. The address keeps the open tab (#cards, #games), so a link can open straight on the games.
function showTab(tab, byHand) {
  if (!run || run.tab === tab) return;
  run.onLeave?.();
  run.onLeave = run.onResize = null;
  const first = !run.drawn && tab === 'map';
  run.tab = tab;
  for (const [t] of TABS) {
    const on = t === tab;
    $(`#exTab-${t}`).classList.toggle('on', on);
    $(`#exTab-${t}`).setAttribute('aria-selected', on);
    $(`#exTab-${t}`).tabIndex = on ? 0 : -1;
    $(`#exPanel-${t}`).hidden = !on;
  }
  if (byHand) {
    history.replaceState(history.state, '', location.pathname + location.search + (tab === 'map' ? '' : `#${tab}`));
    ctx.sound?.tap();
  }
  const shared = { ctx, run, panel: $(`#exPanel-${tab}`), showTab: (t) => showTab(t, true) };
  if (tab === 'map') { layout(first); run.drawn = true; }
  else if (tab === 'cards') renderCards(shared);
  else renderGames(shared);
}

// Fit the outline (and its water) into the map box at the current zoom, draw it, and put the pins where they belong.
function layout(first = false) {
  const box = $('#exMap');
  if (!run || !box || run.tab !== 'map') return;
  const W = box.clientWidth, H = box.clientHeight;
  run.story.g = { mob: innerWidth < 720, W, H };
  const m = fitCity(run.c, W, H, run.view);
  if (!m) { $('#exSvg').innerHTML = ''; run.story.outline = null; return; }
  run.map = m;
  run.story.outline = { project: m.project, toXY: m.toXY };
  const svg = $('#exSvg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = cityMapSVG(m, ctx.esc, { id: 'ex' });
  svg.classList.toggle('inking', first);
  $('#exMap').classList.toggle('zoomed', run.view.z > 1.01);
  $('#exMap').style.touchAction = run.view.z > 1.01 ? 'none' : 'pan-y';
  placePins();
  // pins rise once the edge has inked itself in
  setTimeout(() => $('#places')?.classList.add('on'), first ? 1400 : 0);
}

// ---------- zoom, pan and search on the map ----------
// While a finger or the wheel moves the map, the drawn stage is only slid and scaled with CSS (smooth);
// when the gesture ends, the map is redrawn at its new zoom, so lines stay sharp and pins keep their size.
function setupMapControls() {
  const map = $('#exMap'), stage = $('#exStage');
  let g = null;               // the live gesture: { s, tx, ty } on top of the drawn map
  const ptrs = new Map();     // pointers down: id → [x, y]
  let start = null, dragged = false, wheelTimer = 0;

  const local = (e) => { const r = map.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const show = () => { stage.style.transform = g ? `translate(${g.tx}px, ${g.ty}px) scale(${g.s})` : ''; };
  // zoom by f around the point c (in the box)
  const zoomAt = (f, [cx, cy]) => {
    g ||= { s: 1, tx: 0, ty: 0 };
    const z = run.view.z * g.s * f;
    if (z < 1) f = 1 / (run.view.z * g.s);
    if (z > MAX_ZOOM) f = MAX_ZOOM / (run.view.z * g.s);
    g.s *= f; g.tx = cx - f * (cx - g.tx); g.ty = cy - f * (cy - g.ty);
    show();
  };
  // turn the CSS gesture into the map's own view, and redraw
  const commit = () => {
    if (!g || !run) return;
    const { W, H } = run.map || {}, v = run.view;
    if (!W) { g = null; show(); return; }
    const z = clamp(v.z * g.s, 1, MAX_ZOOM);
    const x = (W / 2 - g.s * W / 2 + g.s * v.x * W * v.z - g.tx) / (W * z);
    const y = (H / 2 - g.s * H / 2 + g.s * v.y * H * v.z - g.ty) / (H * z);
    run.view = z <= 1.01 ? { z: 1, x: 0.5, y: 0.5 } : { z, x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
    g = null;
    stage.style.transition = '';
    show();
    layout();
  };
  run.flyTo = (view) => {
    if (!run.map) return;
    const { W, H } = run.map, v = run.view, s = view.z / v.z;
    g = { s, tx: W / 2 - view.x * W * view.z - s * (W / 2 - v.x * W * v.z), ty: H / 2 - view.y * H * view.z - s * (H / 2 - v.y * H * v.z) };
    if (reduced()) { commit(); return; }
    stage.style.transition = 'transform .45s cubic-bezier(.3,.7,.2,1)';
    show();
    setTimeout(commit, 460);
  };

  map.addEventListener('wheel', (e) => {
    if (!run.map) return;
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), local(e));
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(commit, 160);
  }, { passive: false });

  map.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ex-zoom, .place-list') || !run.map) return;
    ptrs.set(e.pointerId, local(e));
    dragged = false;
    start = { pts: new Map(ptrs), g: g ? { ...g } : { s: 1, tx: 0, ty: 0 } };
  });
  map.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId) || !start) return;
    ptrs.set(e.pointerId, local(e));
    const ids = [...ptrs.keys()].filter((id) => start.pts.has(id));
    if (!ids.length) return;
    const now = ids.map((id) => ptrs.get(id)), was = ids.map((id) => start.pts.get(id));
    const mid = (l) => [l.reduce((a, p) => a + p[0], 0) / l.length, l.reduce((a, p) => a + p[1], 0) / l.length];
    const [mx, my] = mid(now), [wx, wy] = mid(was);
    const f = ids.length > 1 ? Math.hypot(now[0][0] - now[1][0], now[0][1] - now[1][1]) / Math.max(1, Math.hypot(was[0][0] - was[1][0], was[0][1] - was[1][1])) : 1;
    // one finger at the whole-city view is left to scroll the page (touch-action: pan-y)
    if (!dragged && Math.hypot(mx - wx, my - wy) < 6 && Math.abs(f - 1) < 0.04) return;
    if (!dragged) { dragged = true; try { map.setPointerCapture(e.pointerId); } catch { /* the pointer may be gone */ } }
    let s = start.g.s * f;
    s = clamp(s, 1 / run.view.z, MAX_ZOOM / run.view.z);
    const k = s / start.g.s;
    g = { s, tx: mx - k * (wx - start.g.tx), ty: my - k * (wy - start.g.ty) };
    show();
  });
  const up = (e) => {
    if (!ptrs.delete(e.pointerId)) return;
    if (ptrs.size) { start = { pts: new Map(ptrs), g: g ? { ...g } : { s: 1, tx: 0, ty: 0 } }; return; }
    start = null;
    if (dragged) commit();
  };
  map.addEventListener('pointerup', up);
  map.addEventListener('pointercancel', up);
  // a drag that ends on a pin is not a tap on the pin
  map.addEventListener('click', (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);

  $$('.ex-zoom button', map).forEach((b) => b.addEventListener('click', () => {
    if (!run.map) return;
    const { W, H } = run.map;
    if (b.dataset.zoom === 'reset') run.flyTo({ z: 1, x: 0.5, y: 0.5 });
    else { zoomAt(b.dataset.zoom === 'in' ? 1.8 : 1 / 1.8, [W / 2, H / 2]); commit(); }
  }));

  // find a place by name: the list shows as you type; picking one flies the map to it and opens its card
  const find = $('#exFind'), found = $('#exFound');
  let hits = [], at = -1;
  const close = () => { found.hidden = true; find.setAttribute('aria-expanded', 'false'); at = -1; };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const draw = () => {
    found.innerHTML = hits.length
      ? hits.map((i, k) => { const p = run.places[i]; return `<li role="option" id="exHit${k}" data-i="${i}" aria-selected="${k === at}">${ctx.esc(p.name)}<small>${ctx.esc(p.subcategory || 'Heritage place')}</small></li>`; }).join('')
      : '<li class="none">No place by that name yet.</li>';
    found.hidden = false;
    find.setAttribute('aria-expanded', 'true');
    if (at >= 0) find.setAttribute('aria-activedescendant', `exHit${at}`); else find.removeAttribute('aria-activedescendant');
  };
  find.addEventListener('input', () => {
    const q = norm(find.value.trim());
    if (q.length < 2) { close(); return; }
    hits = run.places.map((p, i) => [i, norm(p.name), norm(p.native_name), norm(p.subcategory)])
      .filter(([, n, nn, sub]) => n.includes(q) || nn.includes(q) || sub.includes(q))
      .sort((a, b) => (b[1].startsWith(q) - a[1].startsWith(q)) || (!!run.places[b[0]].description - !!run.places[a[0]].description))
      .slice(0, 8).map(([i]) => i);
    at = hits.length ? 0 : -1;
    draw();
  });
  find.addEventListener('keydown', (e) => {
    if (found.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); at = clamp(at + (e.key === 'ArrowDown' ? 1 : -1), 0, hits.length - 1); draw(); }
    else if (e.key === 'Enter' && at >= 0) { e.preventDefault(); goPlace(hits[at]); }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); }
  });
  found.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) goPlace(Number(li.dataset.i)); });
  find.addEventListener('blur', () => setTimeout(close, 150));
  const goPlace = (i) => { close(); find.value = run.places[i].name; find.blur(); flyToPlace(i); };

  $('#exSurprise').addEventListener('click', () => {
    const told = run.places.map((p, i) => [p, i]).filter(([p]) => p.description && !isBare(p) && fitCity(run.c, 100, 100).project(p.longitude, p.latitude));
    if (!told.length) return;
    let pick;
    do pick = told[Math.floor(Math.random() * told.length)][1]; while (told.length > 1 && pick === run.story.place);
    ctx.sound?.tap();
    flyToPlace(pick);
  });
}

// Zoom in on one place, light its pin and open its card.
function flyToPlace(i) {
  const p = run.places[i];
  if (!p || !run.map) return;
  const { W, H } = run.map, base = fitCity(run.c, W, H);
  const [x, y] = base.toXY(p.longitude, p.latitude);
  // a hidden kind or an unwritten place would not show its pin, so show it
  $('#places').classList.remove(`hide-${$(`#places .pp[data-i="${i}"]`)?.className.match(/k-(\w+)/)?.[1]}`);
  $$('#placeLegend [data-kind]').forEach((b) => { if (!$('#places').classList.contains(`hide-${b.dataset.kind}`)) b.setAttribute('aria-pressed', 'true'); });
  if (isBare(p)) { $('#places').classList.add('show-bare'); $('#placeLegend [data-bare]')?.setAttribute('aria-pressed', 'true'); }
  run.flyTo({ z: Math.max(run.view.z, 5), x: x / W, y: y / H });
  showPlace(i);
  if (innerWidth < 860) setTimeout(() => $('#placeCard').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' }), 500);
}
