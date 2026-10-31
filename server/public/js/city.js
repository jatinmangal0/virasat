// A city, from delivery to map:
//   0. the camera flies through the gate's arch: the city view opens inside the arch, which grows past the screen
//   1. a white dove flies in over the city with the sealed scroll in its feet, drops it and flies off
//   2. the seal stays shut until the visitor signs in (Google, or email); then it breaks and the twine falls,
//      still tied to the scroll
//   3. the scroll unrolls under the city's picture, which fills the top half of the screen. Inside: the letter
//      and four quick facts
//   4. scrolling down follows the twine: it becomes a wave of the city's major events, then moves to the left
//      as a timeline while each event is shown in the middle.
//   5. after the last event, the event card turns into the way on: the city's Explore page (its own address,
//      /<city>/explore: the map now, flashcards and games later), the other city, or the street.
import { twineSVG, setTwine, Rope, GARLAND_DEFS, placeGarland } from './twine.js';
import { motifSVG } from './motifs.js';
import { stampHTML } from './stamps.js';
import { fit } from './lib.js';
import { heroSVG, archPath } from './hero.js';
import { initQuiz } from './quiz.js';

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
  initQuiz({ ctx, cur: () => cur, relayout: () => layoutAfterOpen(), marks: SEAL_MARK });
  $('#pigeon').innerHTML = PIGEON;
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${GARLAND_DEFS}</svg>`);
  $('#cityBack').onclick = closeCity;
  // the same switch as the moon in the top bar (night.js), which the city page covers
  $('#cityNight').onclick = () => document.getElementById('nightBtn')?.click();
  $('#seal').addEventListener('click', () => {
    if (!cur) return;
    if ($('#city').classList.contains('locked')) askToOpen();
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
// A white dove (Jatin's watercolour, assets/dove.webp, 595 × 609, facing left) carries the rolled scroll
// in its feet. The feet's midpoint is at x 49%, y 77.6% of the picture's width.
const PIGEON = `<img class="pg" src="assets/dove.webp" width="595" height="609" alt="" decoding="async">`;
const FOOT = { x: 0.492, y: 0.776 };

// ---------------------------------------------------------------- open a city
export async function openCity(id, my, from = null) {
  const { state, CITIES, esc } = ctx;
  const c = CITIES[id];
  state.city = id;
  const view = $('#city');
  cur = { id, c, my, opened: false };
  view.className = 'city delivering arriving';
  view.style.setProperty('--accent', c.accent);
  renderLetter(c);
  $('#citySky').innerHTML = heroSVG(id);
  // the picture above the letter: the team's poster for the city where there is one, else the drawn scene
  $('#cityHero').innerHTML = c.poster
    ? `<img class="hero-photo" src="${fit(c.poster, 1600)}" alt="${esc(c.name)}: scenes from the city" width="1600" height="900" decoding="async">`
    : heroSVG(id);
  $('#cityHero').classList.toggle('photo', !!c.poster);
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
  if (!reduced()) await archTo(id, from, 'open', 2000);
  if (my !== state.seq) return;
  view.focus({ preventScroll: true });
  drawTie();

  try {
    await deliver(my);
  } catch { return; }
  if (my !== state.seq) return;
  await wait(1000);
  if (my !== state.seq) return;
  // The scroll is addressed to someone: it opens once the visitor has signed in (Google, or email).
  if (state.user) return breakSeal(my);
  view.classList.add('locked');
  $('#openHint').textContent = 'Sign in to open your scroll';
  $('#openHint').hidden = false;
  askToOpen();
}

function askToOpen() {
  if (!cur) return;
  const my = cur.my;
  ctx.state.afterAuth = () => { if (cur && my === ctx.state.seq) breakSeal(my); };
  ctx.openAuth(undefined, `Gaju has a scroll for you from ${cur.c.name}. Sign in to break the seal.`);
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
  // The dove holds the rolled scroll in its feet. While it flies, the scroll is small (about half the dove's
  // width); it hovers, lets go, and the scroll drops and grows to full size.
  const r = sc.getBoundingClientRect();
  const R = $('.roll-top').offsetHeight;
  const knot = { x: r.left + r.width / 2, y: r.top + R };
  const pw = Math.min(230, innerWidth * 0.42);
  const small = clamp((pw * 0.45) / r.width, 0.1, 0.4);
  const hover = Math.min(150, innerHeight * 0.18);     // how high the dove lets go
  sc.style.transformOrigin = `50% ${R}px`;             // scale around the roll, so it stays in the feet
  pg.style.width = pw + 'px';
  const px = knot.x - pw * FOOT.x, py = knot.y - R * small * 0.55 - pw * FOOT.y;
  // The path: in from the top right, a dip, and a hover above the spot where the scroll will land.
  const path = [
    [innerWidth - r.left + 60, -innerHeight * 0.45, -8],
    [innerWidth * 0.45, -innerHeight * 0.3, -4],
    [innerWidth * 0.12, -hover - innerHeight * 0.06, 3],
    [0, -hover - 14, -2],
    [0, -hover, 0],
  ];
  const offs = [0, 0.35, 0.7, 0.88, 1];
  pg.hidden = false;
  pg.classList.add('flying');
  sound.whoosh();
  const timing = { duration: 4600, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' };
  const flyPg = speedUp(pg.animate(path.map(([x, y, rot], i) => ({ transform: `translate(${x + px}px, ${y + py}px) rotate(${rot}deg)`, offset: offs[i] })), timing));
  const flySc = speedUp(sc.animate(path.map(([x, y, rot], i) => ({ transform: `translate(${x}px, ${y}px) rotate(${rot * 0.6}deg) scale(${small})`, offset: offs[i] })), timing));
  cur.flying = [flyPg, flySc];
  view.classList.remove('arriving'); // the scroll is off-screen with the pigeon now, so it can be shown
  await Promise.all([settle(flyPg), settle(flySc)]);
  check();
  await wait(700); // a moment's hover before it lets go
  check();
  // let go: the feet open, the scroll drops and grows, lands with a bump, and the pigeon leaves
  pg.classList.add('released');
  const drop = speedUp(sc.animate([
    { transform: `translate(0px, ${-hover}px) scale(${small})` },
    { transform: `translate(0px, ${-hover * 0.35}px) scale(${lerp(small, 1, 0.55)})`, offset: 0.55 },
    { transform: 'translate(0px, 0px) scale(1)' },
  ], { duration: 1600, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' }));
  flySc.cancel();
  flyPg.cancel();
  const away = pg.animate([
    { transform: `translate(${px}px, ${py - hover}px) rotate(0deg)` },
    { transform: `translate(${px - innerWidth * 0.2}px, ${py - hover - innerHeight * 0.16}px) rotate(-10deg)`, offset: 0.4 },
    { transform: `translate(${-pw - 60}px, ${-innerHeight * 0.45}px) rotate(-16deg)` },
  ], { duration: 2800, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' });
  sound.whoosh();
  settle(away).then(() => { pg.hidden = true; pg.classList.remove('flying', 'released'); away.cancel(); });
  await settle(drop);
  check();
  sound.thunk();
  drop.cancel();
  sc.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(6px) scaleY(.97)' }, { transform: 'translateY(0)' }], { duration: 600, easing: 'ease-out' });
  view.classList.add('show-title');
  await wait(700);
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
    await wait(700);
    check();
    if (state.user) api('/api/progress/visit', { city: cur.id }).then(showEarned);
    ctx.markSeen(cur.id);

    // the twine comes loose and falls, one end still tied to the bottom roller
    const L = $('#runway').offsetHeight + $('.roll-top').offsetHeight / 2;
    startRope(L);
    $('#tie').style.opacity = '0';
    await wait(reduced() ? 0 : 1500);
    check();

    // unroll: the bottom roller travels down, the city's picture fills the top half
    const target = $('#letter').offsetHeight;
    view.classList.add('opened');
    sound.paper();
    const roll = speedUp(sheet.animate([{ height: '0px' }, { height: target + 'px' }], { duration: reduced() ? 1 : 3400, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }));
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
  layer.style.height = view.scrollHeight + 'px'; // the story is not laid out yet; restRope() sizes it properly
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
// The rope layer must end where the story ends. Measuring the page's height while the layer is part of it
// only ever grew it (leaving empty scroll after the map), so it is sized from the story itself.
const storyEnd = () => { const s = $('#story'); return s.offsetTop + s.offsetHeight; };
function restRope() {
  const layer = $('#ropeLayer');
  layer.style.height = storyEnd() + 'px';
  const pts = restPoints(24);
  setTwine($('g.rope', layer), pts, true);
  placeGarland($('g.garland', layer), pts, gardenGap(), gardenScale());
}

function layoutAfterOpen() {
  if (!cur?.story) return;
  measureStory();
  if (!cur.rope) restRope();
  else $('#ropeLayer').style.height = storyEnd() + 'px';
  requestStoryFrame();
}

// ---------------------------------------------------------------- the letter on the scroll
function renderLetter(c) {
  const { state, esc, firstName } = ctx;
  const name = state.user ? firstName(state.user.name) : 'Explorer';
  const lang = LANG[c.id] || '';
  $('#letter').dataset.city = c.id;
  $('#letter').innerHTML = `
    <div class="letter-stamp">${stampHTML(c, `${esc(c.name)} stamp`)}</div>
    <p class="letter-kicker">${esc(c.state)} · ${esc(c.nickname)}</p>
    <h2 id="letterTitle">${esc(c.name)}${c.native ? `<span class="native" lang="${lang}">${esc(c.native)}</span>` : ''}</h2>
    <p class="greet">${esc(c.greeting.replace(/!$/, ''))}, ${esc(name)}! <span>(${esc(c.greetingNote)})</span></p>
    <div class="letter-body">${c.letter.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    <div class="facts" role="list">${c.quickFacts.map(([k, v], i) => `
      <div class="fact" role="listitem" style="--i:${i}">
        <span class="fact-mark" aria-hidden="true">${factIcon(k)}</span>
        <span class="fact-k">${esc(k)}</span>
        <strong class="fact-v">${esc(v)}</strong>
      </div>`).join('')}</div>`;
  $$('#letter img').forEach((im) => im.addEventListener('load', () => { if (cur?.opened) layoutAfterOpen(); }, { once: true }));
}

// A small drawn mark for each quick fact, inside a postmark ring: an hourglass for when, a crown for who,
// a fort for the kingdom, a quill for the language.
function factIcon(label) {
  const k = String(label).toLowerCase();
  const d = /found(ed)?$|year|built|since|date/.test(k) && !/founder/.test(k) ? '<path d="M10 7h12M10 25h12M11 7c0 6 10 7 10 9s-10 3-10 9M21 7c0 6-10 7-10 9s10 3 10 9"/>'
    : /founder|ruler|^king$|built by|by$/.test(k) ? '<path d="M7 22l-1-11 6 5 4-8 4 8 6-5-1 11zM8 25h16"/>'
    : /kingdom|empire|state|dynasty|province|region/.test(k) ? '<path d="M6 25V13l3 2V11l3 2V9h8v4l3-2v4l3-2v12zM14 25v-5h4v5"/>'
    : /capital|seat|court/.test(k) ? '<path d="M5 12l11-6 11 6zM7 12v11M12 12v11M20 12v11M25 12v11M5 25h22"/>'
    : /trad|port|post|harbour|river/.test(k) ? '<path d="M5 20h22l-3 5H8zM16 6v14M16 7l8 10h-8M16 9l-6 8h6"/>'
    : /renamed|name|called/.test(k) ? '<path d="M6 16l9-9h9v9l-9 9zM20 12h.01"/>'
    : /language|tongue|script|speak/.test(k) ? '<path d="M24 6c-8 2-13 8-15 18M24 6c0 7-5 12-12 13M9 24l-2 2"/>'
    : '<path d="M16 7l2.6 6 6.4.6-4.8 4.3 1.4 6.4L16 21l-5.6 3.3 1.4-6.4L7 13.6l6.4-.6z"/>';
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
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
  }, { root: $('#city'), rootMargin: '-35% 0px -35% 0px' }); // in the middle band of the screen, so a section taller than the screen still counts
  $$('#letter .sec').forEach((el) => io.observe(el));
  run.stopWatching = () => { io.disconnect(); timers.forEach(clearTimeout); };
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
        <span class="medal">${e.images?.[0] ? `<img src="${esc(fit(e.images[0].src, 160))}" alt="" loading="lazy">` : motifSVG(e.motif) || `<b>${esc(e.year)}</b>`}</span>
        ${e.images?.[0] || motifSVG(e.motif) ? `<span class="node-year">${esc(e.year)}</span>` : ''}
      </button>`).join('')}</div>
    <div class="ev" id="ev" aria-live="polite"><div class="ev-media" id="evMedia"></div><div class="ev-info" id="evInfo"></div></div>
    <div class="story-end" id="storyEnd">
      <small>That was ${esc(c.name)} through the years</small>
      <h3>There's more to explore in ${esc(c.name)}</h3>
      <p>The map of its heritage places is on ${esc(c.name)}'s Explore page. Flashcards and games are coming there soon.</p>
      <div class="end-btns">
        <button class="btn primary big" data-end="explore">Explore ${esc(c.name)} →</button>
        ${otherId ? `<button class="btn" data-end="${otherId}">Visit ${esc(CITIES[otherId].name)} next</button>` : ''}
        <button class="btn ghost" data-end="back">Back to the street</button>
      </div>
    </div>`;
  cur.story = { ev, active: -1 };
  $$('.node', stage).forEach((b) => b.addEventListener('click', () => jumpTo(Number(b.dataset.i))));
  $$('[data-end]', stage).forEach((b) => b.addEventListener('click', async () => {
    const to = b.dataset.end;
    if (to === 'explore') return ctx.goExplore(cur.id);
    await closeCity();
    if (to !== 'back') { await sleep(300); ctx.goToCity(to, { quick: true }); } // the street was walked once already: the short version
  }));
}

// Lengths of each part of the scroll, in pixels, for the current screen.
function measureStory() {
  const s = cur.story, stage = $('#storyStage');
  const H = innerHeight, W = stage.clientWidth, N = s.ev.length;
  const mob = W < 720;
  s.g = { W, H, N, mob, x0: anchor()[0] - stage.getBoundingClientRect().left, w: threadWidth() };
  s.seg = { wave: H * 1.1, left: N ? H * 0.7 : H * 0.2, events: N ? H * 0.75 * N : 0, end: H * 0.9 };
  const total = Object.values(s.seg).reduce((a, b) => a + b, 0) + H * 0.5;
  $('#story').style.height = total + H + 'px';
  $('#storySvg').innerHTML = twineSVG(s.g.w, 'main') + '<g class="garland" id="storyGarland"></g>';
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
  const a = part(seg.wave), b = part(seg.left), e = part(seg.events), d = part(seg.end);

  // which event is in focus: each one waits a moment, then the thread glides to the next
  const ef = Math.min(N - 1, e * Math.max(N - 0.4, 0)), k = Math.floor(ef), frac = ef - k;
  const eEff = Math.min(N - 1, k + smooth(clamp((frac - 0.55) / 0.45)));
  const uAct = nodeU(Math.max(0, eEff), N);
  const uLast = nodeU(Math.max(0, N - 1), N);

  let shape, visible = 1;
  if (b === 0) { shape = (u) => waveAt(u, g); visible = U0 + (1 - U0) * ease(a); }
  else if (e === 0 && b < 1) { const tb = ease(b); shape = (u) => mixP(waveAt(u, g), leftAt(u, g, nodeU(0, N)), tb); }
  else {
    // after the last event the thread drifts up a little and rests, so the end card takes the event card's place
    const lift = ease(clamp(d / 0.6)) * g.H * 0.18;
    shape = (u) => { const [x, y] = leftAt(u, g, d === 0 ? uAct : uLast); return [x, y - lift]; };
  }

  const pts = [];
  const last = Math.max(1, Math.floor(visible * (M - 1)));
  for (let i = 0; i <= last; i++) pts.push(shape(i / (M - 1), i));
  setTwine($('#storySvg g.twine'), pts);
  placeGarland($('#storyGarland'), pts, gardenGap(), gardenScale());

  // event medallions ride on the thread
  const nodeOpacity = 1;
  $$('.node', stage).forEach((n, i) => {
    const u = nodeU(i, N), [nx, ny] = shape(u, Math.round(u * (M - 1)));
    const shown = b > 0 || visible >= u;
    n.style.transform = `translate(${nx}px, ${ny}px)`;
    n.style.opacity = shown ? nodeOpacity : 0;
    n.classList.toggle('on', b > 0.5 && (d === 0 ? i === Math.round(eEff) : false));
    n.classList.toggle('row', b < 0.5);
    n.tabIndex = shown && nodeOpacity > 0.5 ? 0 : -1;
  });

  $('#storyHead').style.opacity = b > 0 ? clamp(1 - b * 2.5) : clamp(a * 3 + 0.2);
  // the last event's card fades out and the end card rises in its place straight after: never an empty screen
  const out = smooth(clamp((d - 0.05) / 0.25)), cross = smooth(clamp((d - 0.28) / 0.3));
  const evOpacity = N ? clamp((b - 0.55) / 0.4) * (1 - out) : 0;
  $('#ev').style.opacity = evOpacity;
  $('#ev').style.visibility = evOpacity > 0 ? 'visible' : 'hidden';
  if (N && b > 0.5) showEvent(Math.round(eEff));
  const endEl = $('#storyEnd'), endOp = N ? cross : clamp(b * 2);
  endEl.style.opacity = endOp;
  endEl.style.transform = `translateY(${(1 - endOp) * 24}px)`;
  endEl.style.visibility = endOp > 0 ? 'visible' : 'hidden';
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
  const from = s.ev[s.shown ?? i]?.year;
  s.shown = i;
  info.innerHTML = `
    <p class="ev-year${String(e.year).length > 5 ? ' long' : ''}">${esc(e.year)}</p>
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
    ? imgs.map((im, k) => {
      // a caption reads "What it shows. Photo: who, licence": the words in hand, the credit in small print
      const [what, credit] = String(im.caption || '').split(/\s*Photo:\s*/);
      return `<figure class="snap m${k}"><img src="${esc(fit(im.src, 900))}" alt="${esc(what)}" loading="lazy">${im.caption ? `<figcaption>${what ? `<span>${esc(what)}</span>` : ''}${credit ? `<small>Photo: ${esc(credit)}</small>` : ''}</figcaption>` : ''}</figure>`;
    }).join('')
    : `<div class="ev-ghost" aria-hidden="true">${esc(e.year)}</div>
      ${motifSVG(e.motif) ? `<figure class="element"><div class="element-disc">${motifSVG(e.motif)}</div></figure>` : ''}
      <figure class="snap ${motifSVG(e.motif) ? 'm1' : 'm0'} stamp">${stampHTML(c)}</figure>`;
  for (const el of [info, media]) el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  rollYear($('.ev-year', info), from, e.year);
}

// The year counts from the last event's year to this one, so moving along the thread feels like moving
// through time. Labels like "1620s" or "c. 1536" keep their words; only the number rolls.
function rollYear(el, from, to) {
  const n = (y) => Number(/\d{3,4}/.exec(y || '')?.[0]);
  const a = n(from), b = n(to);
  if (!el || reduced() || !Number.isFinite(a) || !Number.isFinite(b) || a === b) return;
  const [pre, post] = String(to).split(String(b));
  const t0 = performance.now(), ms = Math.min(900, 250 + Math.abs(b - a) * 2);
  const step = (t) => {
    if (!el.isConnected) return;
    const k = clamp((t - t0) / ms), v = Math.round(a + (b - a) * (1 - (1 - k) ** 3));
    el.textContent = `${pre}${v}${post}`;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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
