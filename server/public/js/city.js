// A city, from delivery to map:
//   0. the camera flies through the gate's arch: the city view opens inside the arch, which grows past the screen
//   1. a pigeon flies in over the city with a sealed scroll tied to its leg, drops it and flies off
//   2. the seal breaks (no login needed) and the twine falls, still tied to the scroll
//   3. the scroll unrolls under the city's picture, which fills the top half of the screen. Inside: the letter,
//      fact cards by section, and "Seal the letter", a short quiz that presses the city's seal into the wax
//   4. scrolling down follows the twine: it becomes a wave of events, moves to the left as a
//      timeline while each event is shown in the middle, then swirls off, comes back and draws
//      the outline of the city.
//   5. the city's heritage places light up inside the outline, and each one opens a card.
import { twineSVG, setTwine, Rope, GARLAND_DEFS, placeGarland } from './twine.js';
import { motifSVG } from './motifs.js';
import { stampHTML } from './stamps.js';
import { heroSVG, archPath } from './hero.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (t) => t * t * (3 - 2 * t);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// An animation's promise can stall in a background tab, so never wait longer than it should take.
const settle = (anim) => Promise.race([anim.finished, sleep(anim.effect.getTiming().duration / (anim.playbackRate || 1) + 250)]).catch(() => {});
// Skipping (the Skip button, or a city seen before) plays the same sequence, just much faster.
const pace = () => (ctx.state.fast ? 0.18 : 1);
const wait = (ms) => sleep(ms * pace());
const speedUp = (anim) => { anim.playbackRate = 1 / pace(); return anim; };
// The seal on each city's scroll carries Virasat's initial in the city's own script.
const SEAL_MARK = { udaipur: 'वि', kolkata: 'বি' };
const LANG = { udaipur: 'hi', kolkata: 'bn' };

let ctx;      // what app.js shares: state, CITIES, api, sound, esc, firstName, openAuth, showEarned, goToCity, resetStreet
let cur = null; // the open city: { id, c, my, rope, story, ... }

export function initCity(shared) {
  ctx = shared;
  $('#pigeon').innerHTML = PIGEON;
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${GARLAND_DEFS}</svg>`);
  $('#cityBack').onclick = closeCity;
  // the same switch as the moon in the top bar (night.js), which the city page covers
  $('#cityNight').onclick = () => document.getElementById('nightBtn')?.click();
  $('#seal').addEventListener('click', () => {
    if (!cur) return;
    if ($('#city').classList.contains('locked')) ctx.openAuth('phone');
    else breakSeal(cur.my);
  });
  $('#city').addEventListener('scroll', () => cur?.story && requestStoryFrame());
  addEventListener('resize', () => { if (cur?.opened) layoutAfterOpen(); });
  $('#cpClose').onclick = () => { $('#checkpoint').hidden = true; };
  // the arrival scene leans a little with the pointer, each layer by its depth
  $('#city').addEventListener('pointermove', (e) => {
    if (reduced() || !cur) return;
    const dx = e.clientX / innerWidth - 0.5, dy = e.clientY / innerHeight - 0.5;
    $$('#citySky .hero-layer, #cityHero .hero-layer').forEach((g) => {
      const d = Number(g.dataset.depth) || 0;
      g.style.transform = `translate(${-dx * d * 120}px, ${-dy * d * 40}px)`;
    });
  });
}

// ---------------------------------------------------------------- through the arch
// The city view is clipped to the shape of the gate's opening, starting exactly over the little arch on the
// street and growing until its edges are far past the screen. The arch's blue border grows with it, so you
// see yourself pass through the gate. `from` is the opening's box on screen; null means start from the middle.
let archAnim = 0;
function archTo(id, from, to, ms) {
  const view = $('#city'), frame = $('#archFrame');
  const W = innerWidth, H = innerHeight;
  const start = from || { x: W * 0.45, y: H * 0.42, w: W * 0.1, h: H * 0.18 };
  // big enough that every corner of the screen is inside the arch, with its border well outside
  const big = Math.max(W, H) * 3.2;
  const end = { x: W / 2 - big / 2, y: H / 2 - big * 0.42, w: big, h: big * 1.2 };
  const [a, b] = to === 'open' ? [start, end] : [end, start];
  const ring = id === 'kolkata' ? '#f3e3c3' : '#2b45a6';
  const my = ++archAnim;
  return new Promise((done) => {
    const t0 = performance.now();
    const step = (t) => {
      if (my !== archAnim) return done();
      const k = clamp((t - t0) / (ms * pace()));
      const e = to === 'open' ? 1 - (1 - k) ** 3 : k * k * k;
      const r = { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e) };
      const d = archPath(id, r.x, r.y, r.w, r.h);
      view.style.clipPath = `path('${d}')`;
      const sw = Math.max(4, r.w * 0.06);
      frame.innerHTML = `<path d="${d}" stroke="${ring}" stroke-width="${sw}"/><path d="${archPath(id, r.x - sw * 0.9, r.y - sw * 0.9, r.w + sw * 1.8, r.h + sw * 0.9)}" stroke="#3a2420" stroke-width="${Math.max(1.5, sw * 0.25)}"/>`;
      if (k < 1) requestAnimationFrame(step);
      else { if (to === 'open') { view.style.clipPath = ''; frame.innerHTML = ''; } done(); }
    };
    requestAnimationFrame(step);
    // frames stop in background tabs; never leave the city half-clipped
    setTimeout(() => { if (my === archAnim && to === 'open') { view.style.clipPath = ''; frame.innerHTML = ''; } done(); }, ms * pace() + 400);
  });
}

// ---------------------------------------------------------------- the pigeon
// Drawn facing left. Its wings flap with CSS; its tether hangs from its feet.
const PIGEON = `
<svg class="pg" viewBox="0 0 200 130">
  <defs>
    <linearGradient id="pgNeck" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5d8f7a"/><stop offset=".5" stop-color="#7a5f9a"/><stop offset="1" stop-color="#8d95a6"/></linearGradient>
    <linearGradient id="pgBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7aebd"/><stop offset="1" stop-color="#868ea0"/></linearGradient>
  </defs>
  <g class="pg-wing far"><path d="M100,64 C114,26 146,8 172,12 C158,24 152,34 148,42 C160,44 168,48 170,54 C148,60 126,68 104,72 Z" fill="#7b8397"/></g>
  <path d="M138,68 L192,56 L196,70 L190,86 L138,82 Z" fill="#6f7789"/>
  <path d="M176,58 L192,56 L196,70 L190,86 L178,84 Z" fill="#3f4555"/>
  <ellipse cx="104" cy="72" rx="46" ry="25" fill="url(#pgBody)"/>
  <path d="M70,80 Q100,104 140,84 Q110,92 70,80 Z" fill="#c3c8d3"/>
  <path d="M60,58 Q68,38 88,50 Q92,72 74,82 Q62,74 60,58 Z" fill="url(#pgNeck)"/>
  <circle cx="57" cy="47" r="15" fill="#8e96a8"/>
  <circle cx="51" cy="44" r="3.4" fill="#f0a030"/><circle cx="50.6" cy="44" r="1.7" fill="#141414"/>
  <ellipse cx="44" cy="47.5" rx="3.2" ry="2.2" fill="#ece8df"/>
  <path d="M42,48 L30,51.5 L42,54 Z" fill="#3b3b3b"/>
  <path d="M98,94 l-3,13 M110,94 l3,13 M95,107 l-6,3 M95,107 l1,5 M113,107 l6,3 M113,107 l-1,5" stroke="#d0605a" stroke-width="3" stroke-linecap="round" fill="none"/>
  <g class="pg-wing near">
    <path d="M96,62 C110,18 150,2 182,8 C164,20 154,30 150,40 C162,40 172,44 176,50 C152,60 126,72 104,76 Z" fill="#b8bfcc" stroke="#7b8397" stroke-width="1.5"/>
    <path d="M120,48 C136,38 150,34 164,34 M114,58 C132,50 148,46 168,46" stroke="#3f4555" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  </g>
</svg>
<svg class="tether" viewBox="0 0 20 90">${twineSVG(3.5)}</svg>`;

// ---------------------------------------------------------------- open a city
export async function openCity(id, my, from = null) {
  const { state, CITIES, esc } = ctx;
  const c = CITIES[id];
  state.city = id;
  const view = $('#city');
  cur = { id, c, my, opened: false, places: [] };
  loadPlaces(cur);
  view.className = 'city delivering arriving';
  view.style.setProperty('--accent', c.accent);
  renderLetter(c);
  $('#citySky').innerHTML = heroSVG(id);
  $('#cityHero').innerHTML = heroSVG(id);
  $('#sealMark').textContent = SEAL_MARK[id] || 'V';
  $('#postTitle').innerHTML = `<small>Virasat Dak</small>A scroll from ${esc(c.name)}`;
  $('#checkpoint').hidden = true;
  $('#openHint').hidden = true;
  $('#sheet').style.height = '0px';
  $('#scroll').className = 'scroll';
  $('#tie').style.opacity = '';
  $('#ropeLayer').style.display = 'none';
  $('#storyStage').innerHTML = '';
  $('#story').style.height = '0px';
  view.hidden = false;
  view.scrollTop = 0;
  document.body.classList.add('locked');
  document.querySelector('main').inert = true;
  if (!reduced()) await archTo(id, from, 'open', 1150);
  if (my !== state.seq) return;
  view.focus({ preventScroll: true });
  drawTie();

  try {
    await deliver(my);
  } catch { return; }
  if (my !== state.seq) return;
  // Reading is free: the seal breaks for everyone. An account only keeps your stamps and points.
  await wait(500);
  breakSeal(my);
}

// The twine wrapped round the closed scroll: crossing strands, a knot, two loose ends.
function drawTie() {
  const sc = $('#scroll'), w = sc.clientWidth, R = $('.roll-top').offsetHeight, cx = w / 2;
  const tie = $('#tie');
  tie.setAttribute('viewBox', `0 0 ${w} ${2 * R}`);
  const strands = [[-22, 8], [-9, 21], [17, -13], [28, -1]].map(([a, b]) =>
    [[cx + a, -3], [cx + (a + b) / 2 + 2, R], [cx + b, 2 * R + 3]]);
  const ends = [
    [[cx, R], [cx - 24, R + 32], [cx - 60, R + 66], [cx - 56, R + 104], [cx - 78, R + 134]],
    [[cx, R], [cx + 16, R + 38], [cx + 8, R + 88], [cx + 28, R + 122]],
  ];
  const knot = [[cx - 10, R - 6], [cx + 8, R - 10], [cx + 12, R + 6], [cx - 6, R + 11], [cx - 12, R - 2], [cx + 4, R - 4]];
  tie.innerHTML = [...strands, ...ends, knot].map(() => twineSVG(4)).join('') +
    ends.map((e) => { const [x, y] = e[e.length - 1]; return `<path d="M${x},${y} l-5,9 M${x},${y} l2,10 M${x},${y} l6,7" stroke="#c9a675" stroke-width="1.3" stroke-linecap="round"/>`; }).join('');
  const gs = $$('g.twine', tie);
  [...strands, ...ends, knot].forEach((pts, i) => setTwine(gs[i], pts, true));
}

async function deliver(my) {
  const { state, sound } = ctx;
  const check = () => { if (my !== state.seq) throw new Error('cancelled'); };
  const sc = $('#scroll'), pg = $('#pigeon'), view = $('#city');
  if (reduced()) {
    view.classList.remove('arriving');
    await settle(sc.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'both' }));
    view.classList.add('show-title');
    return;
  }
  // The pigeon's feet sit straight above the knot, with the tether between them.
  const r = sc.getBoundingClientRect();
  const knot = { x: r.left + r.width / 2, y: r.top + $('.roll-top').offsetHeight };
  const pw = Math.min(210, innerWidth * 0.36), tether = Math.min(86, innerHeight * 0.1);
  pg.style.width = pw + 'px';
  pg.style.setProperty('--tether', tether + 'px');
  const ts = $('.tether', pg);
  ts.setAttribute('viewBox', `0 0 20 ${tether}`);
  setTwine($('g.twine', ts), [[10, 0], [12, tether * 0.45], [10, tether]], true);
  const footX = pw * 0.52, footY = pw * 0.55; // the feet, in the drawing's 200 × 130 box
  const px = knot.x - footX, py = knot.y - tether - footY;
  // The path: in from the top right, a dip, a little hover, and down.
  const path = [
    [innerWidth - r.left + 60, -innerHeight * 0.45, -8],
    [innerWidth * 0.45, -innerHeight * 0.28, -4],
    [innerWidth * 0.12, -innerHeight * 0.06, 3],
    [0, -14, -2],
    [0, 0, 0],
  ];
  pg.hidden = false;
  pg.classList.add('flying');
  sound.whoosh();
  const kf = (extra) => path.map(([x, y, rot], i) => ({ transform: `translate(${x + extra.x}px, ${y + extra.y}px) rotate(${rot}deg)`, offset: [0, 0.35, 0.7, 0.88, 1][i] }));
  const timing = { duration: 2300, easing: 'cubic-bezier(.35,.1,.3,1)', fill: 'both' };
  const flyPg = speedUp(pg.animate(kf({ x: px, y: py }), timing));
  const flySc = speedUp(sc.animate(path.map(([x, y, rot], i) => ({ transform: `translate(${x}px, ${y}px) rotate(${rot * 0.6}deg)`, offset: [0, 0.35, 0.7, 0.88, 1][i] })), timing));
  cur.flying = [flyPg, flySc];
  view.classList.remove('arriving'); // the scroll is off-screen with the pigeon now, so it can be shown
  await Promise.all([settle(flyPg), settle(flySc)]);
  check();
  // touch down: the scroll settles with a bump, the tether slips off the leg and the pigeon leaves
  sound.thunk();
  sc.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(6px) scaleY(.97)' }, { transform: 'translateY(0)' }], { duration: 380, easing: 'ease-out' });
  view.classList.add('show-title');
  pg.classList.add('released');
  await wait(420);
  check();
  flyPg.cancel();
  const away = pg.animate([
    { transform: `translate(${px}px, ${py}px) rotate(0deg)` },
    { transform: `translate(${px - innerWidth * 0.2}px, ${py - innerHeight * 0.18}px) rotate(-10deg)`, offset: 0.4 },
    { transform: `translate(${-pw - 60}px, ${-innerHeight * 0.4}px) rotate(-16deg)` },
  ], { duration: 1300, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'both' });
  sound.whoosh();
  await wait(500);
  flySc.cancel();
  settle(away).then(() => { pg.hidden = true; pg.classList.remove('flying', 'released'); away.cancel(); });
}

// ---------------------------------------------------------------- break the seal and unroll
let opening = false;
async function breakSeal(my) {
  const { state, sound, api, showEarned } = ctx;
  if (opening || !cur || my !== state.seq) return;
  opening = true;
  const view = $('#city'), sc = $('#scroll'), sheet = $('#sheet');
  view.classList.remove('locked');
  $('#checkpoint').hidden = true;
  $('#openHint').hidden = true;
  try {
    const check = () => { if (my !== state.seq) throw new Error('cancelled'); };
    sc.classList.add('broken');
    sound.crack();
    await wait(320);
    check();
    if (state.user) api('/api/progress/visit', { city: cur.id }).then(showEarned);
    ctx.markSeen(cur.id);

    // the twine comes loose and falls, one end still tied to the bottom roller
    const L = $('#runway').offsetHeight + $('.roll-top').offsetHeight / 2;
    startRope(L);
    $('#tie').style.opacity = '0';
    await wait(reduced() ? 0 : 900);
    check();

    // unroll: the bottom roller travels down, the city's picture fills the top half
    const target = $('#letter').offsetHeight;
    view.classList.add('opened');
    sound.paper();
    const roll = speedUp(sheet.animate([{ height: '0px' }, { height: target + 'px' }], { duration: reduced() ? 1 : 1700, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' }));
    await settle(roll);
    check();
    sheet.style.height = 'auto';
    roll.cancel();
    view.classList.remove('delivering');
    cur.opened = true;
    ctx.sequenceDone();
    buildStory();
    layoutAfterOpen();
    watchSections();
  } catch { /* cancelled by going back */ }
  opening = false;
}

// Where the falling twine is tied: on the bottom roller, a little in from the left.
function anchor() {
  const view = $('#city'), r = $('#rollBottom').getBoundingClientRect();
  return [r.left + r.width * 0.1, r.top + r.height / 2 + view.scrollTop];
}

function startRope(L) {
  const layer = $('#ropeLayer'), view = $('#city');
  layer.style.display = '';
  layer.style.height = view.scrollHeight + 'px';
  layer.innerHTML = twineSVG(threadWidth(), 'rope') + '<g class="garland"></g>';
  const g = $('g.rope', layer);
  const A = anchor();
  if (reduced()) { setTwine(g, [A, [A[0], A[1] + L]]); return; }
  // lay the rope along the bottom roller to the knot, then down the loose end, so the hand-over is not seen
  const r = $('#scroll').getBoundingClientRect(), R = $('.roll-top').offsetHeight;
  const cx = r.left + r.width / 2, top = r.top + view.scrollTop;
  const guide = [A, [cx - 20, A[1]], [cx, top + R], [cx - 24, top + R + 32], [cx - 60, top + R + 66], [cx - 56, top + R + 104], [cx - 60, top + R + 104 + L]];
  const n = 44, seg = L / (n - 1), pts = [];
  let gi = 0, pos = [...guide[0]];
  for (let i = 0; i < n; i++) {
    pts.push([...pos]);
    let left = seg;
    while (left > 0 && gi < guide.length - 1) {
      const to = guide[gi + 1], d = Math.hypot(to[0] - pos[0], to[1] - pos[1]);
      if (d >= left) { pos = [pos[0] + ((to[0] - pos[0]) * left) / d, pos[1] + ((to[1] - pos[1]) * left) / d]; left = 0; }
      else { left -= d; pos = [...to]; gi++; }
    }
  }
  const rope = new Rope(pts, L);
  cur.rope = rope;
  let last = performance.now(), openedAt = 0;
  const tick = (t) => {
    if (cur?.rope !== rope) return;
    const dt = (t - last) / 1000; last = t;
    rope.pin(0, anchor());
    rope.step(dt);
    if (cur.opened) {
      // once open, ease the swinging rope into its resting line so it meets the timeline exactly
      openedAt ||= t;
      const k = clamp((t - openedAt) / 900);
      const rest = restPoints(n);
      const pts = rope.points().map((q, i) => mixP(q, rest[i], smooth(k)));
      setTwine(g, pts, true);
      placeGarland($('g.garland', layer), pts, gardenGap(), gardenScale());
      if (k >= 1) { cur.rope = null; restRope(); return; }
    } else {
      setTwine(g, rope.points(), true);
      placeGarland($('g.garland', layer), rope.points(), gardenGap(), gardenScale());
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// At rest, the twine hangs from the roller to the top of the timeline, with a slight belly.
const threadWidth = () => (innerWidth < 720 ? 5 : 7);
const gardenGap = () => (innerWidth < 720 ? 40 : 54);
const gardenScale = () => (innerWidth < 720 ? 0.85 : 1.1);

function restPoints(n) {
  const A = anchor(), end = $('#story').offsetTop + 2, sway = Math.min(14, (end - A[1]) * 0.03);
  return Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return [A[0] + sway * Math.sin(t * Math.PI), lerp(A[1], end, t)]; });
}
function restRope() {
  const layer = $('#ropeLayer');
  layer.style.height = $('#city').scrollHeight + 'px';
  const pts = restPoints(24);
  setTwine($('g.rope', layer), pts, true);
  placeGarland($('g.garland', layer), pts, gardenGap(), gardenScale());
}

function layoutAfterOpen() {
  if (!cur?.story) return;
  measureStory();
  if (!cur.rope) restRope();
  else $('#ropeLayer').style.height = $('#city').scrollHeight + 'px';
  requestStoryFrame();
}

// ---------------------------------------------------------------- the letter on the scroll
function renderLetter(c) {
  const { state, esc, firstName } = ctx;
  const name = state.user ? firstName(state.user.name) : 'Explorer';
  const lang = LANG[c.id] || '';
  const sections = c.sections.filter((s) => s.items.length);
  $('#letter').dataset.city = c.id;
  $('#letter').innerHTML = `
    <div class="letter-stamp">${stampHTML(c, `${esc(c.name)} stamp`)}</div>
    <p class="letter-kicker">${esc(c.state)} · ${esc(c.nickname)}</p>
    <h2 id="letterTitle">${esc(c.name)}${c.native ? `<span class="native" lang="${lang}">${esc(c.native)}</span>` : ''}</h2>
    <p class="greet">${esc(c.greeting.replace(/!$/, ''))}, ${esc(name)}! <span>(${esc(c.greetingNote)})</span></p>
    <div class="letter-body">${c.letter.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    <div class="facts">${c.quickFacts.map(([k, v]) => `<div class="fact"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>
    ${c.sources?.length ? `<p class="letter-src">Sources for this letter: ${c.sources.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(' · ')}</p>` : ''}
    <section class="inside" aria-labelledby="insideTitle">
      <div class="inside-h"><h3 id="insideTitle">Inside this letter</h3><small>${sections.length ? `${sections.reduce((n, s) => n + s.items.length, 0)} cards` : ''}</small></div>
      ${sections.length ? sections.map((s) => `
        <div class="sec" data-sec="${esc(s.id)}">
          <p class="sec-label">${SECTION_ICONS[s.id] || ''}${esc(s.label)}<span class="done">Read ✓</span></p>
          <div class="cards">${s.items.map((f) => `
            <article class="card"><h4>${esc(f.title)}${f.draft ? '<span class="draft">draft</span>' : ''}</h4><p>${esc(f.text)}</p>
              ${f.src ? `<a href="${esc(f.src)}" target="_blank" rel="noopener">Source</a>` : ''}</article>`).join('')}</div>
        </div>`).join('')
        : `<p class="inside-empty">Our team is checking the fact cards for ${esc(c.name)} against their sources. Each one appears here once a second teammate has verified it.</p>`}
    </section>
    ${c.quiz.length ? '<section class="sealq" id="sealq" aria-live="polite"></section>' : ''}
    <p class="signoff">With love, Gaju <img src="assets/elephant.png" alt=""></p>`;
  if (c.quiz.length) startQuiz(c);
}

// Drawn icons for the four parts of a letter, in the street's ink.
const ic = (inner) => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const SECTION_ICONS = {
  landmarks: ic('<path d="M6 28V14Q6 8 16 4Q26 8 26 14V28Z"/><path d="M12 28V19Q12 15 16 13Q20 15 20 19V28"/><path d="M3 28h26"/>'),
  festivals: ic('<path d="M7 20h18l-3 7H10Z"/><path d="M16 20c-3-3-3-7 0-11 3 4 3 8 0 11Z"/><path d="M16 4v2"/>'),
  food: ic('<circle cx="16" cy="18" r="11"/><circle cx="16" cy="18" r="6"/><circle cx="9" cy="12" r="1.5"/><circle cx="23" cy="13" r="1.5"/><circle cx="22" cy="24" r="1.5"/>'),
  facts: ic('<circle cx="16" cy="16" r="5"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M25 7l-3 3M10 22l-3 3"/>'),
};

// ---------------------------------------------------------------- reading the fact cards
// A section counts as read once most of it has been on screen for a couple of seconds.
function watchSections() {
  const { state, api, showEarned } = ctx, run = cur;
  const timers = new Map();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const el = en.target;
      if (en.isIntersecting && !timers.has(el)) {
        timers.set(el, setTimeout(() => {
          io.unobserve(el);
          el.classList.add('read');
          if (cur === run && state.user && !el.dataset.draftOnly) api('/api/progress/section', { city: run.id, section: el.dataset.sec }).then(showEarned);
        }, 2000));
      } else if (!en.isIntersecting && timers.has(el)) { clearTimeout(timers.get(el)); timers.delete(el); }
    }
  }, { root: $('#city'), threshold: 0.5 });
  $$('#letter .sec').forEach((el) => io.observe(el));
  run.stopWatching = () => { io.disconnect(); timers.forEach(clearTimeout); };
}

// ---------------------------------------------------------------- seal the letter
// Up to five questions, one at a time. Answers are marked by the server (drafts in demo mode carry their
// answer, since only editors can see them). The score presses one, two or three wax seals.
function startQuiz(c) {
  const pool = [...c.quiz].sort(() => Math.random() - 0.5).slice(0, 5);
  cur.quiz = { pool, i: 0, picks: [], right: 0 };
  drawQuestion();
}

function drawQuestion() {
  const { esc } = ctx, q = cur.quiz, box = $('#sealq');
  const item = q.pool[q.i];
  box.innerHTML = `
    <div class="sealq-head"><div class="wax" aria-hidden="true">${SEAL_MARK[cur.id] || 'V'}</div>
      <div><h3>Seal the letter</h3><p>Answer to press ${esc(cur.c.name)}'s seal into the wax.</p></div></div>
    <div class="sealq-steps" aria-hidden="true">${q.pool.map((_, k) => `<i class="${k < q.i ? (q.picks[k].ok ? 'ok' : 'no') : k === q.i ? 'now' : ''}"></i>`).join('')}</div>
    <p class="q-text">${esc(item.q)}${item.draft ? '<span class="q-draft">draft</span>' : ''}</p>
    <div class="q-opts">${item.options.map((o, k) => `<button class="q-opt" data-k="${k}">${esc(o)}</button>`).join('')}</div>
    <p class="q-feedback" id="qFeedback"></p>`;
  $$('.q-opt', box).forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.k))));
  layoutAfterOpen();
}

async function answer(choice) {
  const { api, esc, sound } = ctx, q = cur.quiz, run = cur, item = q.pool[q.i];
  const btns = $$('#sealq .q-opt');
  btns.forEach((b) => { b.disabled = true; });
  let ok, right;
  if (item.draft) { right = item.answer; ok = choice === right; }
  else {
    const r = await api('/api/quiz/check', { id: item.id, choice });
    if (cur !== run) return;
    if (!r.ok) { btns.forEach((b) => { b.disabled = false; }); $('#qFeedback').textContent = r.data.error; return; }
    ({ correct: ok, answer: right } = r.data);
  }
  q.picks.push({ id: item.id, choice, ok, draft: !!item.draft });
  if (ok) q.right++;
  btns[choice].classList.add(ok ? 'right' : 'wrong');
  btns[right]?.classList.add('right');
  ok ? sound.ding() : sound.buzz();
  const last = q.i === q.pool.length - 1;
  $('#qFeedback').innerHTML = (ok ? '<b>Shabash!</b> That is right.' : `Not quite. The answer is <b>${esc(item.options[right])}</b>.`) +
    `<br><button class="btn primary q-next" id="qNext">${last ? 'Press the seal' : 'Next question'}</button>`;
  $('#qNext').addEventListener('click', () => { if (last) finishQuiz(); else { q.i++; drawQuestion(); } });
  $('#qNext').focus({ preventScroll: true });
}

async function finishQuiz() {
  const { state, api, showEarned, esc, sound } = ctx, q = cur.quiz, run = cur;
  const share = q.right / q.pool.length;
  const seals = share === 1 ? 3 : share >= 0.8 ? 2 : share >= 0.6 ? 1 : 0;
  const mark = SEAL_MARK[cur.id] || 'V';
  const words = ['The wax did not set this time. Read the cards again and try once more.',
    'One seal pressed. A good start.', 'Two seals pressed. Nearly perfect.', 'All three seals pressed. A perfect letter!'][seals];
  $('#sealq').innerHTML = `<div class="seal-result">
      <div class="wax-row">${[0, 1, 2].map((k) => `<div class="wax ${k < seals ? 'press' : 'off'}" style="--d:${k * 0.25}s">${mark}</div>`).join('')}</div>
      <h4>${q.right} of ${q.pool.length} right</h4><p>${esc(words)}</p>
      <button class="btn" id="qAgain">Try again</button></div>`;
  if (seals) sound.thunk();
  $('#qAgain').addEventListener('click', () => startQuiz(cur.c));
  layoutAfterOpen();
  const real = q.picks.filter((p) => !p.draft);
  if (state.user && real.length) {
    const r = await api('/api/progress/quiz', { city: run.id, answers: real.map(({ id, choice }) => ({ id, choice })) });
    if (cur === run) showEarned(r);
  } else if (!state.user) {
    $('#cpTitle').textContent = 'Sign your passport';
    $('#cpText').textContent = `${seals ? 'Your seal is pressed.' : 'Your letter is read.'} Sign your passport and Virasat keeps your ${esc(cur.c.name)} stamp and score, on any device.`;
    $('#checkpoint').hidden = false;
  }
}

// ---------------------------------------------------------------- the timeline and the map
const M = 360;     // points along the thread
const U0 = 0.14;   // the first part of the thread drops in from the scroll; events sit on the rest
const nodeU = (i, N) => U0 + (1 - U0) * ((i + 0.5) / Math.max(N, 1));

function buildStory() {
  const { esc, CITIES } = ctx;
  const c = cur.c, ev = c.timeline || [];
  const otherId = Object.keys(CITIES).find((k) => k !== cur.id);
  const stage = $('#storyStage');
  stage.innerHTML = `
    <svg class="story-svg" id="storySvg" aria-hidden="true"></svg>
    <div class="story-head" id="storyHead"><small>The thread of time</small><h3>${esc(c.name)} through the years</h3>
      <p>${ev.length ? 'Keep scrolling to follow the thread' : 'Our team is still checking the events for this timeline. Come back soon!'}</p></div>
    <div class="nodes">${ev.map((e, i) => `
      <button class="node" data-i="${i}" aria-label="${esc(e.year)}: ${esc(e.title)}">
        <span class="medal">${e.images?.[0] ? `<img src="${esc(e.images[0].src)}" alt="" loading="lazy">` : motifSVG(e.motif) || `<b>${esc(e.year)}</b>`}</span>
        ${e.images?.[0] || motifSVG(e.motif) ? `<span class="node-year">${esc(e.year)}</span>` : ''}
      </button>`).join('')}</div>
    <div class="ev" id="ev" aria-live="polite"><div class="ev-media" id="evMedia"></div><div class="ev-info" id="evInfo"></div></div>
    <div class="place-legend" id="placeLegend"></div>
    <div class="places" id="places"></div>
    <aside class="place-card" id="placeCard" aria-live="polite" hidden></aside>
    <div class="map-end" id="mapEnd">
      <h3>${esc(c.name)}</h3>
      <p id="mapNote">Soon, this map will hold ${esc(c.name)}'s landmarks.</p>
      <div class="map-btns">
        <button class="btn" data-end="back">← Back to the street</button>
        ${otherId ? `<button class="btn primary" data-end="${otherId}">Visit ${esc(CITIES[otherId].name)} next →</button>` : ''}
      </div>
      ${c.outlineSource ? `<p class="map-src">City outline: ${esc(c.outlineSource.replace(/: https?:\/\/\S+$/, ''))}</p>` : ''}
    </div>`;
  cur.story = { ev, active: -1, outline: null, place: null };
  renderPlaces();
  $$('.node', stage).forEach((b) => b.addEventListener('click', () => jumpTo(Number(b.dataset.i))));
  $$('[data-end]', stage).forEach((b) => b.addEventListener('click', async () => {
    const to = b.dataset.end;
    await closeCity();
    if (to !== 'back') { await sleep(300); ctx.goToCity(to); }
  }));
}

// Lengths of each part of the scroll, in pixels, for the current screen.
function measureStory() {
  const s = cur.story, stage = $('#storyStage');
  const H = innerHeight, W = stage.clientWidth, N = s.ev.length;
  const mob = W < 720;
  s.g = { W, H, N, mob, x0: anchor()[0] - stage.getBoundingClientRect().left, w: threadWidth() };
  s.seg = { wave: H * 1.1, left: N ? H * 0.7 : H * 0.2, events: N ? H * 0.75 * N : 0, swirl: H * 1.7, map: H * 1.1 };
  const total = Object.values(s.seg).reduce((a, b) => a + b, 0) + H * 0.5;
  $('#story').style.height = total + H + 'px';
  $('#storySvg').innerHTML = twineSVG(s.g.w, 'main') + '<g class="garland" id="storyGarland"></g>';
  s.outline = fitOutline(cur.c.outline || [], s.g, cur.places.length > 0);
  placePins();
}

// The city boundary, [lng, lat], fitted into the middle of the screen and spaced evenly along its edge.
// With places to show on a wide screen, the map moves left to make room for the place card.
function fitOutline(ring, { W, H, mob }, roomForCard) {
  if (ring.length < 3) {
    return Array.from({ length: M }, (_, i) => { const a = (i / (M - 1)) * Math.PI * 2; return [W / 2 + Math.cos(a) * H * 0.25, H * 0.45 + Math.sin(a) * H * 0.25]; });
  }
  const lat0 = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xy = ring.map(([lng, lat]) => [lng * k, -lat]);
  const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
  const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
  const card = roomForCard && !mob;
  const boxW = mob ? W * 0.8 : Math.min(W * (card ? 0.46 : 0.5), 620), boxH = H * (mob ? 0.46 : card ? 0.58 : 0.52);
  const sc = Math.min(boxW / bw, boxH / bh);
  const cx = card ? W * 0.38 : W / 2, cy = H * (mob ? 0.4 : card ? 0.43 : 0.41);
  const ox = cx - ((Math.min(...xs) + bw / 2) * sc), oy = cy - ((Math.min(...ys) + bh / 2) * sc);
  const pts = xy.map(([x, y]) => [x * sc + ox, y * sc + oy]);
  if (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) pts.push(pts[0]);
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1], out = [];
  let j = 0;
  for (let i = 0; i < M; i++) {
    const d = (i / (M - 1)) * total;
    while (j < lens.length - 2 && lens[j + 1] < d) j++;
    const t = (d - lens[j]) / (lens[j + 1] - lens[j] || 1);
    out.push([lerp(pts[j][0], pts[j + 1][0], t), lerp(pts[j][1], pts[j + 1][1], t)]);
  }
  // where a [lng, lat] lands on screen, or null when it is well outside the city
  const minX = Math.min(...xs), minY = Math.min(...ys);
  out.project = (lng, lat) => {
    const x = lng * k, y = -lat;
    if (x < minX - bw * 0.2 || x > minX + bw * 1.2 || y < minY - bh * 0.2 || y > minY + bh * 1.2) return null;
    return [x * sc + ox, y * sc + oy];
  };
  return out;
}

// ----- the shapes the thread takes; each maps u (0 at the scroll end, 1 at the far end) to a point
function waveAt(u, g) {
  const { W, H, mob, x0 } = g;
  // wide screens: a wave across the screen; phones: the thread snakes down the screen instead
  const left = W * 0.07, right = W - left, cy = H * 0.56, A = H * 0.13, per = 2.5;
  const mTop = H * 0.34, mBot = H * 0.92, mA = W * 0.3;
  const at = (v) => (mob ? [W / 2 + mA * Math.sin(v * Math.PI * 2 * 1.5), lerp(mTop, mBot, v)]
    : [left + v * (right - left), cy + A * Math.sin(v * per * Math.PI * 2)]);
  if (u <= U0) {
    const t = u / U0, a = 1 - t;
    // drops from the scroll's twine, then curves into the start of the wave
    const [sx, sy] = at(0);
    const P = mob ? [[x0, -2], [x0, sy * 0.6], [sx - mA * 0.6, sy - 30], [sx, sy]] : [[x0, -2], [x0, cy * 0.55], [left - 10, cy - A * 0.9], [sx, sy]];
    return [a ** 3 * P[0][0] + 3 * a * a * t * P[1][0] + 3 * a * t * t * P[2][0] + t ** 3 * P[3][0],
      a ** 3 * P[0][1] + 3 * a * a * t * P[1][1] + 3 * a * t * t * P[2][1] + t ** 3 * P[3][1]];
  }
  return at((u - U0) / (1 - U0));
}

function leftAt(u, g, uAct) {
  const { H, N, mob } = g;
  const colX = mob ? 46 : 104, amp = mob ? 7 : 26, gap = H * (mob ? 0.2 : 0.27);
  const K = gap / ((1 - U0) / Math.max(N, 1));
  const v = (u - U0) / (1 - U0);
  return [colX + amp * Math.sin(v * Math.max(N, 1) * Math.PI), H * 0.5 + (u - uAct) * K];
}

const offAt = (u, g) => [g.W * 1.12 + u * g.W * 1.5, g.H * 0.5 + g.H * 0.3 * Math.sin(u * Math.PI * 2.2)];

function spiralAt(u, g, phase) {
  const R = Math.min(g.W, g.H) * (g.mob ? 0.44 : 0.4);
  const a = phase + u * Math.PI * 2 * 3, r = R * (1 - 0.82 * u);
  return [g.W / 2 + Math.cos(a) * r, g.H * 0.46 + Math.sin(a) * r];
}

const mixP = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

let storyQueued = false;
function requestStoryFrame() {
  if (storyQueued) return;
  storyQueued = true;
  requestAnimationFrame(() => { storyQueued = false; if (cur?.story?.g) drawStory(); });
}

function drawStory() {
  const s = cur.story, g = s.g, seg = s.seg, N = g.N;
  const view = $('#city'), stage = $('#storyStage');
  const y = view.scrollTop - $('#story').offsetTop;
  let t = y;
  const part = (len) => { const p = len ? clamp(t / len) : 1; t -= len; return p; };
  const a = part(seg.wave), b = part(seg.left), e = part(seg.events), d = part(seg.swirl), m = part(seg.map);

  // which event is in focus: each one waits a moment, then the thread glides to the next
  const ef = Math.min(N - 1, e * Math.max(N - 0.4, 0)), k = Math.floor(ef), frac = ef - k;
  const eEff = Math.min(N - 1, k + smooth(clamp((frac - 0.55) / 0.45)));
  const uAct = nodeU(Math.max(0, eEff), N);
  const uLast = nodeU(Math.max(0, N - 1), N);

  let shape, visible = 1;
  if (b === 0) { shape = (u) => waveAt(u, g); visible = U0 + (1 - U0) * ease(a); }
  else if (e === 0 && b < 1) { const tb = ease(b); shape = (u) => mixP(waveAt(u, g), leftAt(u, g, nodeU(0, N)), tb); }
  else if (d === 0) shape = (u) => leftAt(u, g, uAct);
  else if (m === 0) {
    if (d < 0.32) { const td = ease(d / 0.32); shape = (u) => mixP(leftAt(u, g, uLast), offAt(u, g), td); }
    else if (d < 0.42) shape = (u) => offAt(u, g);
    else { const td = (d - 0.42) / 0.58, ph = td * Math.PI * 3; shape = (u) => mixP(offAt(u, g), spiralAt(u, g, ph), ease(td)); }
  } else {
    const ph = Math.PI * 3 + m * Math.PI, tm = ease(clamp(m / 0.85));
    shape = (u, i) => mixP(spiralAt(u, g, ph), s.outline[i], tm);
  }

  const pts = [];
  const last = Math.max(1, Math.floor(visible * (M - 1)));
  for (let i = 0; i <= last; i++) pts.push(shape(i / (M - 1), i));
  setTwine($('#storySvg g.twine'), pts);
  placeGarland($('#storyGarland'), pts, gardenGap(), gardenScale());

  // event medallions ride on the thread
  const nodeOpacity = d > 0 ? clamp(1 - d / 0.15) : 1;
  $$('.node', stage).forEach((n, i) => {
    const u = nodeU(i, N), [nx, ny] = shape(u, Math.round(u * (M - 1)));
    const shown = b > 0 || visible >= u;
    n.style.transform = `translate(${nx}px, ${ny}px)`;
    n.style.opacity = shown ? nodeOpacity : 0;
    n.classList.toggle('on', b > 0.5 && d === 0 && i === Math.round(eEff));
    n.classList.toggle('row', b < 0.5);
    n.tabIndex = shown && nodeOpacity > 0.5 ? 0 : -1;
  });

  $('#storyHead').style.opacity = b > 0 ? clamp(1 - b * 2.5) : clamp(a * 3 + 0.2);
  const evOpacity = N ? (d > 0 ? clamp(1 - d / 0.12) : clamp((b - 0.55) / 0.4)) : 0;
  $('#ev').style.opacity = evOpacity;
  $('#ev').style.visibility = evOpacity > 0 ? 'visible' : 'hidden';
  if (N && b > 0.5) showEvent(Math.round(eEff));
  const end = clamp((m - 0.7) / 0.25);
  for (const el of [$('#mapEnd'), $('#placeLegend'), $('#placeCard')]) {
    el.style.opacity = end;
    el.style.visibility = end > 0 ? 'visible' : 'hidden';
  }
  $('#places').classList.toggle('on', m > 0.8);
}

function showEvent(i) {
  const s = cur.story;
  if (s.active === i) return;
  s.active = i;
  const { esc, c } = { esc: ctx.esc, c: cur.c };
  const e = s.ev[i];
  const info = $('#evInfo'), media = $('#evMedia');
  // When an event is remembered differently from what the sources show, both sides are shown.
  info.classList.toggle('two-sides', !!e.memory);
  info.innerHTML = `
    <p class="ev-year">${esc(e.year)}</p>
    <h3>${esc(e.title)}</h3>
    ${e.memory ? `<div class="sides">
        <div class="side record"><small>The record</small><p>${esc(e.text)}</p>${e.src ? `<a href="${esc(e.src)}" target="_blank" rel="noopener">Source</a>` : ''}</div>
        <div class="side memory"><small>The memory</small><p>${esc(e.memory)}</p>${e.memorySrc ? `<a href="${esc(e.memorySrc)}" target="_blank" rel="noopener">Source</a>` : ''}</div>
      </div>${e.argued ? `<p class="argued"><b>Why it is argued about:</b> ${esc(e.argued)}</p>` : ''}`
    : `<p class="ev-text">${esc(e.text)}</p>
    ${e.src ? `<a class="ev-src" href="${esc(e.src)}" target="_blank" rel="noopener">Source</a>` : ''}`}
    <p class="ev-count">${i + 1} of ${s.ev.length}${e.draft ? ' · <span class="draft">draft, not yet checked</span>' : ''}</p>`;
  const imgs = (e.images || []).slice(0, 4);
  media.innerHTML = imgs.length
    ? imgs.map((im, k) => `<figure class="snap m${k}"><img src="${esc(im.src)}" alt="${esc(im.caption)}" loading="lazy">${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`).join('')
    : `<div class="ev-ghost" aria-hidden="true">${esc(e.year)}</div>
      ${motifSVG(e.motif) ? `<figure class="element"><div class="element-disc">${motifSVG(e.motif)}</div></figure>` : ''}
      <figure class="snap ${motifSVG(e.motif) ? 'm1' : 'm0'} stamp">${stampHTML(c)}</figure>`;
  for (const el of [info, media]) el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

// ---------------------------------------------------------------- heritage places on the map
// Places come from the team's research (the Places tab on the editor page): the checked ones, plus
// drafts in demo mode. Each sits on the outline map as a marigold, coloured by what kind of place it is.
const PLACE_KINDS = [
  ['built', 'Buildings', /built|architecture|fortif/i],
  ['culture', 'Living culture', /living|intangible|culinary|craft|perform/i],
  ['nature', 'Lakes and nature', /hydro|ecolog|natural|landscape/i],
  ['civic', 'Institutions', /institution|civic|sport|archive|literary/i],
];
const kindOf = (p) => (PLACE_KINDS.find((k) => k[2].test(p.category || '')) || PLACE_KINDS[0])[0];

// Commons "Special:FilePath" links become a sized https image, plus the file's page for the credit.
function photoOf(url) {
  const m = /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/(.+)$/i.exec(url || '');
  if (m) return { src: `https://commons.wikimedia.org/wiki/Special:FilePath/${m[1]}?width=640`, page: `https://commons.wikimedia.org/wiki/File:${m[1]}` };
  return /^https:\/\//i.test(url || '') ? { src: url, page: url } : null;
}

async function loadPlaces(run) {
  const r = await ctx.api(`/api/cities/${run.id}/places`);
  const list = [...(r.ok ? r.data.places : []), ...(ctx.state.demo?.places?.[run.id] || [])]
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  if (cur !== run || !list.length) return;
  // described places are drawn last, so they sit on top
  run.places = list.sort((a, b) => !!a.description - !!b.description);
  if (run.story) { renderPlaces(); layoutAfterOpen(); }
}

function renderPlaces() {
  const { esc } = ctx, list = cur.places;
  if (!list.length) return;
  const count = Object.fromEntries(PLACE_KINDS.map((k) => [k[0], list.filter((p) => kindOf(p) === k[0]).length]));
  $('#placeLegend').innerHTML = PLACE_KINDS.filter((k) => count[k[0]])
    .map(([id, label]) => `<button class="chip k-${id}" data-kind="${id}" aria-pressed="true"><i></i>${label} <b>${count[id]}</b></button>`).join('');
  $('#places').innerHTML = list.map((p, i) => `<button class="pp k-${kindOf(p)}${p.description ? ' big' : ''}" data-i="${i}"
      style="--d:${(i % 40) * 18}ms" aria-label="${esc(p.name)}"><span class="pp-name">${esc(p.name)}</span></button>`).join('');
  $$('#places .pp').forEach((b) => b.addEventListener('click', () => showPlace(Number(b.dataset.i))));
  $$('#placeLegend .chip').forEach((b) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on);
    $('#places').classList.toggle('hide-' + b.dataset.kind, !on);
  }));
  // wide screens open on a place with a photo and a description, so the card is never empty
  if (innerWidth >= 720) {
    const pick = list.findLastIndex((p) => p.description && photoOf(p.image_url));
    showPlace(pick >= 0 ? pick : list.findLastIndex((p) => p.description));
  }
}

function placePins() {
  const s = cur.story;
  if (!s?.outline?.project) return;
  $$('#places .pp').forEach((b) => {
    const p = cur.places[b.dataset.i], xy = s.outline.project(p.longitude, p.latitude);
    b.hidden = !xy;
    if (xy) { b.style.left = xy[0] + 'px'; b.style.top = xy[1] + 'px'; }
  });
  const shown = $$('#places .pp:not([hidden])').length, drafts = cur.places.some((p) => p.draft);
  $('#mapNote').textContent = `${shown} heritage places, researched by our team${drafts ? ' (drafts, not yet checked)' : ''}. Tap a marigold to explore.`;
}

function showPlace(i) {
  const { esc } = ctx, p = cur.places[i], card = $('#placeCard');
  if (!p) return;
  cur.story.place = i;
  $$('#places .pp').forEach((b) => b.classList.toggle('sel', Number(b.dataset.i) === i));
  const photo = photoOf(p.image_url);
  card.innerHTML = `
    <button class="pc-close" aria-label="Close">×</button>
    ${photo ? `<figure class="pc-photo"><img src="${esc(photo.src)}" alt="${esc(p.name)}" loading="lazy">
      <figcaption><a href="${esc(photo.page)}" target="_blank" rel="noopener">Photo: Wikimedia Commons</a></figcaption></figure>` : ''}
    <p class="pc-kind k-${kindOf(p)}"><i></i>${esc(p.subcategory || 'Heritage place')}${p.year ? ` · since ${esc(p.year)}` : ''}</p>
    <h4>${esc(p.name)}</h4>
    ${p.native_name ? `<p class="pc-native">${esc(p.native_name)}</p>` : ''}
    <p class="pc-text">${p.description ? esc(p.description) : 'Our team is still writing about this place.'}</p>
    <p class="pc-foot">${p.source_url ? `<a href="${esc(p.source_url)}" target="_blank" rel="noopener">Source</a>` : ''}${p.draft ? '<span class="draft">draft, not yet checked</span>' : ''}</p>`;
  card.hidden = false;
  $('img', card)?.addEventListener('error', (ev) => ev.target.closest('figure').remove());
  $('.pc-close', card).addEventListener('click', () => { card.hidden = true; $$('#places .pp.sel').forEach((b) => b.classList.remove('sel')); });
  card.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
}

// Scroll to where event i is in focus (a little after it arrives, before the glide to the next).
function jumpTo(i) {
  const s = cur.story, N = s.ev.length;
  const into = N > 1 ? s.seg.events * Math.min(1, (i + 0.2) / (N - 0.4)) : 1;
  $('#city').scrollTo({ top: $('#story').offsetTop + s.seg.wave + s.seg.left + into, behavior: reduced() ? 'auto' : 'smooth' });
}

// ---------------------------------------------------------------- leave
export async function closeCity() {
  const { state } = ctx;
  state.seq++;
  state.afterAuth = null;
  opening = false;
  const id = cur?.id;
  if (cur) { cur.rope = null; cur.stopWatching?.(); }
  cur = null;
  const pg = $('#pigeon');
  pg.getAnimations().forEach((a) => a.cancel());
  $('#scroll').getAnimations().forEach((a) => a.cancel());
  pg.hidden = true;
  $('#checkpoint').hidden = true;
  ctx.sequenceDone();
  ctx.resetStreet();
  // step back out through the arch while the street pulls back
  if (id && !reduced()) await archTo(id, null, 'close', 650);
  $('#city').hidden = true;
  $('#city').style.clipPath = '';
  $('#archFrame').innerHTML = '';
  document.querySelector('main').inert = false;
}

export const cityIsOpen = () => !$('#city').hidden;
