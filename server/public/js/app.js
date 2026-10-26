import { buildScene, grain, VB, GATES } from './scene.js';
// City content comes from the database through the API (/api/cities), loaded in boot().
let CITIES = {};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// two frames so a class change animates; capped because frames never come in a background tab
const nextFrame = () => Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), new Promise((r) => setTimeout(r, 60))]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const firstName = (n) => String(n || '').split(' ')[0] || 'Explorer';

const state = { user: null, config: { googleClientId: null, smsMode: 'demo' }, busy: false, city: null, seq: 0, afterAuth: null, sound: false };

// ---------------- api ----------------
async function api(path, body) {
  try {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach the server. Check your connection.' } };
  }
}

// Show "+10 points" when the server says something earned points.
function showEarned(r) {
  if (r?.ok && r.data.earned > 0) toast(`+${r.data.earned} points · ${r.data.points} in total`);
}

// ---------------- toast ----------------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ---------------- sound (synthesised, off until asked) ----------------
const sound = (() => {
  let ctx;
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  function noise(dur, freq, q, gain) {
    if (!state.sound) return;
    const c = ac(), len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination); src.start();
  }
  function tone(type, from, to, dur, gain = 0.12) {
    if (!state.sound) return;
    const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur);
  }
  return {
    whoosh: () => noise(0.5, 900, 0.7, 0.5),
    paper: () => noise(0.35, 2400, 1.2, 0.35),
    thunk: () => { noise(0.12, 180, 1, 1.2); tone('sine', 120, 60, 0.18, 0.3); },
    tap: () => tone('triangle', 660, 520, 0.08, 0.1),
    crack: () => noise(0.18, 1400, 3, 0.8),
    toot: () => { tone('sawtooth', 260, 520, 0.35, 0.07); setTimeout(() => tone('sawtooth', 520, 700, 0.4, 0.06), 180); },
    ding: () => { tone('sine', 880, 880, 0.25, 0.12); setTimeout(() => tone('sine', 1320, 1320, 0.35, 0.1), 120); },
    buzz: () => tone('square', 160, 120, 0.22, 0.05),
    ctx: () => ac(),
  };
})();

// ---------------- ticker, drawer, header ----------------
function setupChrome() {
  const star = `<svg viewBox="0 0 32 32"><g fill="#8a4b1c">${Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45} 16 16)" d="M16 16 L14 4 Q16 1 18 4 Z"/>`).join('')}<circle cx="16" cy="16" r="3.2" fill="#5a2e10"/></g></svg>`;
  const items = ['Walk into two cities with Gaju the elephant', 'Udaipur · City of Lakes', 'Kolkata · City of Joy', 'Collect stamps in your Virasat passport', 'Learn · Play · Explore'];
  const run = items.map((t) => `<span>${esc(t)} ${star}</span>`).join('');
  $('#ticker').innerHTML = run + run;
  $('#year').textContent = new Date().getFullYear();

  const drawer = $('#drawer'), scrim = $('#scrim');
  const open = () => { drawer.classList.add('open'); scrim.classList.add('show'); drawer.setAttribute('aria-hidden', 'false'); };
  window.closeDrawer = () => { drawer.classList.remove('open'); scrim.classList.remove('show'); drawer.setAttribute('aria-hidden', 'true'); };
  $('#menuBtn').onclick = open;
  $('#drawerClose').onclick = closeDrawer;
  scrim.onclick = closeDrawer;
  $$('[data-close]').forEach((a) => a.addEventListener('click', closeDrawer));

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { e.preventDefault(); closeDrawer(); goToCity(go.dataset.go); return; }
    const op = e.target.closest('[data-open]');
    if (op) {
      e.preventDefault(); closeDrawer();
      if (op.dataset.open === 'journey') openJourney();
      if (op.dataset.open === 'auth') state.user ? logout() : openAuth('phone');
    }
  });

  $('#accountBtn').onclick = () => (state.user ? openJourney() : openAuth('phone'));
  $('#journeyBtn').onclick = openJourney;
  $('#soundBtn').onclick = () => {
    state.sound = !state.sound;
    $('#soundBtn').setAttribute('aria-pressed', state.sound);
    $('#soundBtn').setAttribute('aria-label', state.sound ? 'Turn sound off' : 'Turn sound on');
    if (state.sound) { sound.ctx().resume?.(); sound.ding(); }
  };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = $$('.modal').find((x) => !x.hidden);
    if (m) closeModal(m); else closeDrawer();
  });
}

function renderHeader() {
  const btn = $('#accountBtn'), av = $('#accountAvatar');
  btn.querySelector('.initial')?.remove();
  if (state.user) {
    btn.classList.add('signed-in');
    btn.setAttribute('aria-label', `${state.user.name}: open my passport`);
    if (state.user.avatar) { av.src = state.user.avatar; av.hidden = false; }
    else { av.hidden = true; btn.insertAdjacentHTML('beforeend', `<span class="initial">${esc(state.user.name[0]?.toUpperCase() || 'V')}</span>`); }
    $('#drawerAuth').textContent = 'Log out';
  } else {
    btn.classList.remove('signed-in');
    btn.setAttribute('aria-label', 'Log in or sign up');
    av.hidden = true;
    $('#drawerAuth').textContent = 'Log in / Sign up';
  }
}

// ---------------- the 3D street ----------------
const scene = {
  gx: 800, walk: null, cam: 0, rx: 0, ry: 0, rxT: 0, ryT: 0, zoom: 0, zoomT: 0, pox: 50, poy: 50, poxT: 50, poyT: 50,
  view: { W: 1, H: 1, ww: 1, wh: 1 }, running: false, lastDust: 0,
};

function setupStreet() {
  const street = $('#street'), world = $('#world');
  const layers = buildScene(world);
  street.insertAdjacentHTML('beforeend', grain + '<div class="flash"></div>');

  layers.road.insertAdjacentHTML('beforeend', `
    <div class="gaju" id="gaju" role="button" tabindex="0" aria-label="Gaju the elephant. Tap for a fact.">
      <div class="bubble" id="bubble">Namaste! I'm Gaju. Where shall we go?</div>
      <div class="gaju-shadow"></div>
      <div class="gaju-body"><img src="assets/elephant.png" alt="Gaju the elephant" draggable="false"></div>
    </div>`);
  const pins = [['udaipur', 'u', GATES.udaipur, 168, 'Udaipur'], ['kolkata', 'k', GATES.kolkata + 100, 178, 'Kolkata']];
  layers.buildings.insertAdjacentHTML('beforeend', pins.filter(([id]) => CITIES[id]).map(([id, cls, x, y, label]) => `
    <button class="pin ${cls}" data-go="${id}" style="left:${(x / VB.w) * 100}%;top:${(y / VB.h) * 100}%" aria-label="Walk to ${label}">
      <span class="pin-face"><img src="${CITIES[id].stamp}" alt=""></span><span class="pin-label">${label}</span>
    </button>`).join(''));
  $$('.gate', world).forEach((g) => g.addEventListener('click', () => goToCity(g.dataset.city)));

  const gaju = $('#gaju');
  const tell = () => {
    if (state.busy) return;
    const all = Object.values(CITIES).flatMap((c) => c.sections.find((s) => s.id === 'facts')?.items.map((i) => i.title) || []);
    say(all.length ? `Fun fact: ${all[Math.floor(Math.random() * all.length)]}! Pick a city to learn more.` : 'Pick a city and I will walk you there!', 4200);
    gaju.classList.remove('cheer'); void gaju.offsetWidth; gaju.classList.add('cheer');
    sound.toot();
  };
  gaju.addEventListener('click', tell);
  gaju.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tell(); } });

  // tilt with the mouse or the phone
  const hint = $('#dragHint');
  let hinted = false;
  street.addEventListener('pointermove', (e) => {
    const r = street.getBoundingClientRect();
    const tx = ((e.clientX - r.left) / r.width) * 2 - 1, ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    scene.ryT = tx * 7; scene.rxT = -ty * 3.5;
    if (!hinted) { hinted = true; setTimeout(() => hint.classList.add('gone'), 2500); settleHeadline(); }
  });
  street.addEventListener('pointerleave', () => { scene.ryT = 0; scene.rxT = 0; });
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    scene.ryT = clamp(e.gamma / 4, -8, 8);
    scene.rxT = clamp((e.beta - 45) / -10, -4, 4);
  });
  // iOS asks permission for motion; ask on the first tap anywhere
  document.addEventListener('click', function askMotion() {
    document.removeEventListener('click', askMotion);
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }
  });

  // focusing a pin can make the browser scroll this clipped box sideways; keep it pinned
  street.addEventListener('scroll', () => { street.scrollLeft = 0; street.scrollTop = 0; });

  const layout = () => {
    const W = street.clientWidth, H = street.clientHeight;
    // On tall phone screens, show about two screen-widths of street and let the camera pan.
    let wh = W < H ? Math.min(H, (W * 2 * VB.h) / VB.w) : H;
    let ww = (wh * VB.w) / VB.h;
    if (ww < W) { ww = W; wh = (W * VB.h) / VB.w; }
    const stage = $('#stage');
    stage.style.width = ww + 'px';
    stage.style.height = wh + 'px';
    scene.view = { W, H, ww, wh };
  };
  layout();
  window.addEventListener('resize', layout);
  startLoop();
}

// The big Kumarri-style greeting shows first, then tucks itself into the sky so the gates stay clear.
function settleHeadline() {
  clearTimeout(settleHeadline.t);
  settleHeadline.t = setTimeout(() => $('.headline').classList.add('settled'), 2600);
}

let lastT = 0;
function startLoop() {
  if (scene.running) return;
  scene.running = true;
  lastT = performance.now();
  requestAnimationFrame(frame);
}
function frame(t) {
  if (!scene.running) return;
  const dt = Math.min(0.25, (t - lastT) / 1000); // slow devices still finish the walk on time
  lastT = t;
  const gaju = $('#gaju');
  if (scene.walk) {
    const w = scene.walk, dir = Math.sign(w.to - scene.gx) || 1;
    scene.gx += dir * 230 * dt;
    if ((dir > 0 && scene.gx >= w.to) || (dir < 0 && scene.gx <= w.to)) {
      scene.gx = w.to; scene.walk = null; gaju.classList.remove('walking'); w.done();
    } else if (t - scene.lastDust > 170) {
      scene.lastDust = t;
      const d = document.createElement('span');
      d.className = 'dust';
      d.style.left = `calc(${((scene.gx - dir * 60) / VB.w) * 100}% - 9px)`;
      d.style.bottom = `${((VB.h - 716) / VB.h) * 100}%`;
      gaju.parentElement.appendChild(d);
      setTimeout(() => d.remove(), 800);
    }
  }
  gaju.style.left = (scene.gx / VB.w) * 100 + '%';

  const { W, ww } = scene.view;
  const maxCam = Math.max(0, (ww - W) / 2);
  const camT = clamp(ww / 2 - (scene.gx / VB.w) * ww, -maxCam, maxCam);
  const k = (rate) => Math.min(1, dt * rate);
  scene.cam += (camT - scene.cam) * k(4);
  scene.rx += (scene.rxT - scene.rx) * k(3);
  scene.ry += (scene.ryT - scene.ry) * k(3);
  scene.zoom += (scene.zoomT - scene.zoom) * k(2.4);
  scene.pox += (scene.poxT - scene.pox) * k(2.4);
  scene.poy += (scene.poyT - scene.poy) * k(2.4);
  $('#stage').style.transform = `translateX(${(W - ww) / 2 + scene.cam}px)`;
  $('#world').style.transform = `translateZ(${scene.zoom}px) rotateX(${scene.rx}deg) rotateY(${scene.ry}deg)`;
  $('.rig').style.perspectiveOrigin = `${scene.pox}% ${scene.poy}%`;
  requestAnimationFrame(frame);
}

let bubbleTimer;
function say(text, ms = 0) {
  const b = $('#bubble');
  b.textContent = text;
  b.classList.remove('hide');
  clearTimeout(bubbleTimer);
  if (ms) bubbleTimer = setTimeout(() => b.classList.add('hide'), ms);
}

function walkTo(x) {
  const gaju = $('#gaju');
  if (Math.abs(x - scene.gx) < 4) return Promise.resolve();
  // the drawing faces left, so flip it when walking right
  gaju.style.setProperty('--face', x > scene.gx ? -1 : 1);
  gaju.classList.add('walking');
  return new Promise((resolve) => {
    // Frames pause in background tabs; a timer guarantees the walk still ends on schedule.
    let finished = false;
    const done = () => { if (finished) return; finished = true; clearTimeout(guard); resolve(); };
    const guard = setTimeout(() => {
      if (scene.walk?.done !== done) return;
      scene.gx = x; scene.walk = null; gaju.classList.remove('walking'); gaju.style.left = (x / VB.w) * 100 + '%'; done();
    }, (Math.abs(x - scene.gx) / 230) * 1000 + 400);
    scene.walk = { to: x, done };
  });
}

async function goToCity(city) {
  if (!CITIES[city] || state.busy) return;
  state.busy = true;
  const my = ++state.seq;
  const c = CITIES[city];
  if (window.scrollY > 10) { window.scrollTo({ top: 0, behavior: 'smooth' }); await sleep(450); }
  startLoop();
  $('#callout').classList.add('away');
  say(`Chalo! To ${c.name}!`);
  sound.toot();
  await walkTo(GATES[city]);
  if (my !== state.seq) return;
  const gaju = $('#gaju');
  gaju.classList.remove('cheer'); void gaju.offsetWidth; gaju.classList.add('cheer');
  say(`${c.greeting} A letter is waiting for you…`);
  await sleep(1100);
  if (my !== state.seq) return;
  // dolly the camera into the gate
  $('#street').classList.add('zooming');
  scene.poxT = (GATES[city] / VB.w) * 100;
  scene.poyT = ((city === 'udaipur' ? 470 : 460) / VB.h) * 100;
  scene.zoomT = 1050;
  scene.rxT = scene.ryT = 0;
  await sleep(1250);
  if (my !== state.seq) return;
  openPost(city, my);
}

function resetStreet() {
  startLoop();
  const street = $('#street');
  street.classList.remove('zooming');
  scene.zoomT = 0; scene.poxT = 50; scene.poyT = 50;
  $('#callout').classList.remove('away');
  document.body.classList.remove('locked');
  state.busy = false;
  setTimeout(() => say('Where to next?', 3500), 600);
}

// ---------------- post office: envelope → checkpoint → poster ----------------
function stampDate() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en', { month: 'short' }).toUpperCase()} ${String(d.getFullYear()).slice(2)}`;
}

async function openPost(city, my) {
  const c = CITIES[city];
  state.city = city;
  const post = $('#post');
  post.className = 'post';
  post.style.setProperty('--accent', c.accent);
  $('#envPoster').style.visibility = '';
  $('#envStamp').src = c.stamp;
  $('#envStamp').alt = `${c.name} stamp`;
  $('#posterImg').src = c.poster;
  $('#posterImg').alt = `${c.name} poster`;
  $('#envFrom').innerHTML = `<b>From</b>${esc(c.from)}`;
  $('#envTo').textContent = state.user ? state.user.name : 'The Curious Explorer';
  $('#pmCity').textContent = `VIRASAT POST · ${c.name.toUpperCase()}`;
  $('#pmDate').textContent = stampDate();
  $('#postTitle').innerHTML = `<small>Virasat Post</small>A letter from ${esc(c.name)}`;
  $('#checkpoint').hidden = true;
  $('#openHint').hidden = true;
  post.hidden = false;
  document.body.classList.add('locked');
  await Promise.race([Promise.all([$('#posterImg').decode(), $('#envStamp').decode()]).catch(() => {}), sleep(1500)]);
  await nextFrame();
  scene.running = false; // the street is hidden; let it rest

  const step = async (cls, ms, fx) => {
    if (my !== state.seq) throw new Error('cancelled');
    post.classList.add(...cls.split(' '));
    fx?.();
    await sleep(ms);
  };
  try {
    await step('arrive', 1000, sound.whoosh);
    await step('show-title stamped', 650, sound.tap);
    await step('marked', 1000, sound.thunk);
    await step('flip', 1200, sound.whoosh);
  } catch { return; }
  if (my !== state.seq) return;
  if (state.user) breakSeal(my);
  else {
    post.classList.add('locked');
    $('#checkpoint').hidden = false;
    state.afterAuth = () => { $('#checkpoint').hidden = true; breakSeal(my); };
  }
}

// An animation's promise can stall in a background tab, so never wait longer than it should take.
const settle = (anim) => Promise.race([anim.finished, sleep(anim.effect.getTiming().duration + 250)]);

let opening = false;
async function breakSeal(my) {
  if (opening || my !== state.seq) return;
  opening = true;
  const post = $('#post'), city = state.city, c = CITIES[city];
  post.classList.remove('locked');
  $('#checkpoint').hidden = true;
  $('#openHint').hidden = true;
  try {
    const step = async (cls, ms, fx) => {
      if (my !== state.seq) throw new Error('cancelled');
      post.classList.add(cls); fx?.(); await sleep(ms);
    };
    await step('broken', 380, sound.crack);
    await step('flap', 750, sound.paper);
    await step('opened', 300);
    await step('slide', 1050, sound.paper);
    if (my !== state.seq) throw new Error('cancelled');
    api('/api/progress/visit', { city }).then(showEarned);

    // lift the poster out of the envelope and bring it to the front
    const from = $('#envPoster').getBoundingClientRect();
    const fly = $('#posterFly');
    const tw = Math.min(1100, innerWidth * 0.94, (innerHeight * 0.8 * 16) / 9);
    const th = (tw * 9) / 16;
    fly.querySelector('img').src = c.poster;
    Object.assign(fly.style, { left: '0px', top: '0px', width: tw + 'px', height: th + 'px' });
    fly.hidden = false;
    $('#envPoster').style.visibility = 'hidden';
    post.classList.add('out');
    const tx = (innerWidth - tw) / 2, ty = (innerHeight - th) / 2;
    await settle(fly.animate([
      { transform: `translate(${from.left}px, ${from.top}px) scale(${from.width / tw}) rotate(0deg)` },
      { transform: `translate(${tx}px, ${ty - 40}px) scale(1.04) rotate(-2deg)`, offset: 0.7 },
      { transform: `translate(${tx}px, ${ty}px) scale(1) rotate(0deg)` },
    ], { duration: 1100, easing: 'cubic-bezier(.3,.9,.3,1)', fill: 'forwards' }));
    await sleep(1300);
    if (my !== state.seq) throw new Error('cancelled');

    // the letter unfolds underneath and the poster settles into the page header
    renderCity(city);
    const view = $('#city');
    view.hidden = false;
    view.scrollTop = 0;
    const heroRect = $('#cityHero').getBoundingClientRect();
    view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'both' });
    post.hidden = true;
    const sx = heroRect.width / tw, sy = heroRect.height / th;
    await settle(fly.animate([
      { transform: `translate(${tx}px, ${ty}px) scale(1)`, padding: '6px', borderRadius: '6px' },
      { transform: `translate(${heroRect.left}px, ${heroRect.top}px) scale(${sx}, ${sy})`, padding: '0px', borderRadius: '0px' },
    ], { duration: 700, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' }));
    fly.hidden = true;
    fly.getAnimations().forEach((a) => a.cancel());
  } catch { /* cancelled by going back */ }
  opening = false;
}

function closePost() {
  state.seq++;
  state.afterAuth = null;
  opening = false;
  $('#post').hidden = true;
  $('#posterFly').hidden = true;
  resetStreet();
}

// ---------------- the city letter ----------------
function renderCity(id) {
  const c = CITIES[id];
  const view = $('#city');
  view.style.setProperty('--accent', c.accent);
  $('#cityPoster').src = c.poster;
  // absolute, because a url() inside a custom property resolves against the stylesheet
  $('#cityTop').style.setProperty('--poster', `url("${new URL(c.poster, location.href).href}")`);
  $('#cityPoster').alt = `Scenes from ${c.name}`;
  const name = state.user ? firstName(state.user.name) : 'Explorer';
  const tabs = [...c.sections.map((s) => [s.id, s.icon, s.label]), ['quiz', '🏅', 'Quiz']];
  $('#letter').innerHTML = `
    <img class="letter-stamp" src="${c.stamp}" alt="${esc(c.name)} stamp">
    <p class="letter-kicker">${esc(c.state)} · ${esc(c.nickname)}</p>
    <h2>${esc(c.name)}<small>${esc(c.native)}</small></h2>
    <p class="greet">${esc(c.greeting.replace(/!$/, ''))}, ${esc(name)}! <span>(${esc(c.greetingNote)})</span></p>
    <div class="letter-body">${c.letter.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    <div class="facts">${c.quickFacts.map(([k, v]) => `<div class="fact"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>
    <div class="sec-tabs" role="tablist">${tabs.map(([tid, icon, label], i) =>
      `<button class="sec-tab" role="tab" data-sec="${tid}" aria-selected="${i === 0}">${icon} ${esc(label)}</button>`).join('')}</div>
    <div id="secBody"></div>
    ${c.sources ? `<p class="letter-src">Sources for this letter: ${c.sources.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(' · ')}</p>` : ''}
    <p class="signoff">With love, Gaju <img src="assets/elephant.png" alt=""></p>
    <div class="letter-nav">
      <button class="btn" id="letterBack">← Back to the street</button>
      <button class="btn primary" data-other="${id === 'udaipur' ? 'kolkata' : 'udaipur'}">Visit ${id === 'udaipur' ? 'Kolkata' : 'Udaipur'} next →</button>
    </div>`;
  const show = (sid) => {
    $$('.sec-tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.sec === sid));
    if (sid === 'quiz') return renderQuiz(id);
    const s = c.sections.find((x) => x.id === sid);
    if (!s.items.length) {
      $('#secBody').innerHTML = '<p class="empty-note">Our team is still checking the facts for this part. Come back soon!</p>';
      return;
    }
    if (state.user) api('/api/progress/section', { city: id, section: sid }).then(showEarned);
    $('#secBody').innerHTML = `<div class="cards">${s.items.map((it, i) =>
      `<article class="card" style="animation-delay:${i * 60}ms"><h4>${esc(it.title)}</h4><p>${esc(it.text)}</p>${it.src ? `<a class="src" href="${esc(it.src)}" target="_blank" rel="noopener">Source</a>` : ''}</article>`).join('')}</div>`;
  };
  $$('.sec-tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.sec)));
  show(tabs[0][0]);
  $('#letterBack').onclick = closeCity;
  $('[data-other]').onclick = async (e) => {
    const next = e.currentTarget.dataset.other;
    closeCity();
    await sleep(700);
    goToCity(next);
  };
}

function renderQuiz(id) {
  const c = CITIES[id];
  const box = $('#secBody');
  if (!c.quiz.length) {
    box.innerHTML = '<p class="empty-note">The quiz for this city is still being checked by our team. Come back soon!</p>';
    return;
  }
  let i = 0, score = 0, answers = [];
  const draw = () => {
    if (i >= c.quiz.length) return finish();
    const q = c.quiz[i];
    box.innerHTML = `<div class="quiz">
      <div class="quiz-progress">Question ${i + 1} of ${c.quiz.length} · Score ${score}</div>
      <div class="quiz-bar"><i style="width:${(i / c.quiz.length) * 100}%"></i></div>
      <h4>${esc(q.q)}</h4>
      <div class="opts">${q.options.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div>
      <p class="quiz-feedback" aria-live="polite"></p></div>`;
    $$('.opt', box).forEach((b) => b.addEventListener('click', async () => {
      const k = Number(b.dataset.k);
      $$('.opt', box).forEach((x) => { x.disabled = true; });
      // The answer lives on the server, so ask it.
      const r = await api('/api/quiz/check', { id: q.id, choice: k });
      if (!r.ok) {
        $('.quiz-feedback', box).textContent = r.data.error || 'Could not check that answer. Try again.';
        $$('.opt', box).forEach((x) => { x.disabled = false; });
        return;
      }
      answers.push({ id: q.id, choice: k });
      const right = r.data.correct;
      $$('.opt', box).forEach((x) => { if (Number(x.dataset.k) === r.data.answer) x.classList.add('right'); });
      if (!right) b.classList.add('wrong');
      if (right) { score++; sound.ding(); } else sound.buzz();
      $('.quiz-feedback', box).textContent = right ? 'Shabash! That\'s right.' : `Not quite. It's "${q.options[r.data.answer]}".`;
      setTimeout(() => { i++; draw(); }, 1400);
    }));
  };
  const finish = async () => {
    const total = c.quiz.length;
    const msg = score === total ? 'Perfect score! Gaju is doing a happy dance.' : score >= total / 2 ? 'Well done, explorer!' : 'Read the letter again and have another go.';
    box.innerHTML = `<div class="quiz quiz-done"><div class="big">${score}/${total}</div><h4>${msg}</h4>
      <p id="quizSaved">${state.user ? 'Saving to your passport…' : 'Log in to save your score and earn points.'}</p>
      <button class="btn primary" id="retry">Try again</button></div>`;
    $('#retry').onclick = () => { i = 0; score = 0; answers = []; draw(); };
    if (state.user) {
      const r = await api('/api/progress/quiz', { city: id, answers });
      $('#quizSaved').textContent = !r.ok ? 'Could not save this score.'
        : r.data.earned > 0 ? `Saved to your passport. +${r.data.earned} points!` : 'Saved to your passport.';
    }
  };
  draw();
}

function closeCity() {
  $('#city').hidden = true;
  state.seq++;
  resetStreet();
}

// ---------------- auth ----------------
function openModal(m) {
  m.hidden = false;
  document.body.classList.add('locked');
  setTimeout(() => m.querySelector('input:not([type=hidden]), button')?.focus(), 60);
}
function closeModal(m) {
  m.hidden = true;
  if ($('#post').hidden && $('#city').hidden) document.body.classList.remove('locked');
}

function setAuthTab(tab) {
  $$('#authModal .tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === tab));
  $$('#authModal .pane').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
  $('#authError').textContent = '';
  $('#authTitle').textContent = tab === 'signup' ? 'Make your passport' : 'Join the journey';
}

function openAuth(tab = 'phone', reason) {
  setAuthTab(tab === 'signup' ? 'signup' : tab === 'login' ? 'login' : 'phone');
  $('#authSub').textContent = reason || (state.city && !$('#post').hidden
    ? `Log in to break the seal on your letter from ${CITIES[state.city].name}.`
    : 'Log in to open letters and keep your passport.');
  openModal($('#authModal'));
  renderGoogle();
}

function onAuthed(user, isNew) {
  state.user = user;
  renderHeader();
  closeModal($('#authModal'));
  toast(isNew ? `Welcome to Virasat, ${firstName(user.name)}!` : `Welcome back, ${firstName(user.name)}!`);
  const next = state.afterAuth;
  state.afterAuth = null;
  next?.();
}

function busyBtn(form, on) {
  const b = form.querySelector('button[type=submit]:not([hidden])') || form.querySelector('button[type=submit]');
  $$('button[type=submit]', form).forEach((x) => { x.disabled = on; });
  return b;
}

function setupAuth() {
  $$('#authModal .tab').forEach((t) => t.addEventListener('click', () => setAuthTab(t.dataset.tab)));
  $$('[data-tab-go]').forEach((b) => b.addEventListener('click', () => setAuthTab(b.dataset.tabGo)));
  $$('[data-close-modal]').forEach((b) => b.addEventListener('click', () => closeModal(b.closest('.modal'))));
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));
  $$('[data-auth]').forEach((b) => b.addEventListener('click', () => openAuth(b.dataset.auth)));
  $('#seal').addEventListener('click', () => {
    if ($('#post').classList.contains('locked')) openAuth('phone');
    else breakSeal(state.seq);
  });
  $('#postBack').onclick = closePost;
  $('#cityBack').onclick = closeCity;
  const err = (m) => { $('#authError').textContent = m || ''; };

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget, fd = new FormData(f);
    busyBtn(f, true);
    const r = await api('/api/auth/login', { email: fd.get('email'), password: fd.get('password') });
    busyBtn(f, false);
    if (!r.ok) return err(r.data.error);
    f.reset();
    onAuthed(r.data.user, false);
  });

  $('#signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget, fd = new FormData(f);
    busyBtn(f, true);
    const r = await api('/api/auth/signup', { name: fd.get('name'), email: fd.get('email'), password: fd.get('password') });
    busyBtn(f, false);
    if (!r.ok) return err(r.data.error);
    f.reset();
    onAuthed(r.data.user, true);
  });

  // phone + OTP
  const form = $('#phoneForm'), boxes = $$('#otpBoxes input');
  let phone = null, isNew = false, timer;
  const stepTo = (s) => $$('.step', form).forEach((x) => { x.hidden = x.dataset.step !== s; });
  const code = () => boxes.map((b) => b.value).join('');
  const fillCode = (c) => { boxes.forEach((b, k) => { b.value = c[k] || ''; }); boxes[Math.min(c.length, 5)].focus(); };
  const startTimer = (secs) => {
    const btn = $('#resendBtn'), lab = $('#resendTimer');
    btn.disabled = true;
    clearInterval(timer);
    let left = secs;
    const tick = () => {
      lab.textContent = left > 0 ? `in ${left}s` : '';
      if (left <= 0) { btn.disabled = false; clearInterval(timer); }
      left--;
    };
    tick();
    timer = setInterval(tick, 1000);
  };
  const request = async (raw) => {
    const r = await api('/api/auth/otp/request', { phone: raw });
    if (!r.ok) { err(r.data.error); return false; }
    phone = r.data.phone; isNew = r.data.isNew;
    $('#sentTo').textContent = phone;
    form.querySelector('.new-name').hidden = !isNew;
    stepTo('code');
    fillCode('');
    startTimer(r.data.resendIn || 30);
    err('');
    if (r.data.demoCode) showSms(r.data.demoCode);
    return true;
  };
  const ready = () => code().length === 6 && (!isNew || form.querySelector('[name=name]').value.trim());
  const verify = async () => {
    const c = code();
    if (c.length !== 6) return err('Enter all 6 digits.');
    const name = form.querySelector('[name=name]').value;
    if (isNew && !name.trim()) { form.querySelector('[name=name]').focus(); return err('Tell us your name so Gaju knows what to call you.'); }
    busyBtn(form, true);
    const r = await api('/api/auth/otp/verify', { phone, code: c, name });
    busyBtn(form, false);
    if (!r.ok) {
      err(r.data.error);
      $('#otpBoxes').classList.remove('shake'); void $('#otpBoxes').offsetWidth; $('#otpBoxes').classList.add('shake');
      return;
    }
    hideSms();
    stepTo('number');
    form.reset();
    onAuthed(r.data.user, r.status === 201);
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.querySelector('[data-step=number]').hidden) {
      busyBtn(form, true);
      await request(form.querySelector('[name=phone]').value);
      busyBtn(form, false);
    } else verify();
  });
  $('#changeNum').onclick = () => { stepTo('number'); err(''); hideSms(); form.querySelector('[name=phone]').focus(); };
  $('#resendBtn').onclick = () => request(phone);
  boxes.forEach((b, k) => {
    b.addEventListener('input', () => {
      const d = b.value.replace(/\D/g, '');
      if (d.length > 1) { fillCode(d.slice(0, 6)); } else { b.value = d; if (d && k < 5) boxes[k + 1].focus(); }
      if (ready()) verify();
    });
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !b.value && k > 0) boxes[k - 1].focus();
      if (e.key === 'ArrowLeft' && k > 0) boxes[k - 1].focus();
      if (e.key === 'ArrowRight' && k < 5) boxes[k + 1].focus();
    });
    b.addEventListener('paste', (e) => {
      const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (d) { e.preventDefault(); fillCode(d); if (ready()) verify(); }
    });
  });

  let smsTimer;
  function showSms(c) {
    const s = $('#sms');
    $('#smsBody').innerHTML = `<b>${c}</b> is your Virasat login code. It expires in 5 minutes. <small>(Tap to fill)</small>`;
    s.hidden = false;
    s.onclick = () => {
      fillCode(c); hideSms();
      if (ready()) verify(); else form.querySelector('[name=name]').focus();
    };
    clearTimeout(smsTimer);
    smsTimer = setTimeout(hideSms, 15000);
  }
  function hideSms() { $('#sms').hidden = true; }

  // Google
  $('#googleFallback').onclick = () => {
    $('#authError').textContent = 'Google sign-in is not switched on for this site yet (the owner needs to add a Google Client ID). Use your phone or email for now.';
  };
}

let gisLoaded = null;
function renderGoogle() {
  const id = state.config.googleClientId;
  if (!id) { $('#googleFallback').hidden = false; return; }
  gisLoaded ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  }).then(() => {
    google.accounts.id.initialize({
      client_id: id,
      callback: async ({ credential }) => {
        const r = await api('/api/auth/google', { credential });
        if (!r.ok) { $('#authError').textContent = r.data.error; return; }
        onAuthed(r.data.user, r.status === 201);
      },
    });
  });
  gisLoaded.then(() => {
    const slot = $('#googleSlot');
    slot.innerHTML = '';
    google.accounts.id.renderButton(slot, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: Math.min(360, slot.clientWidth || 360) });
    $('#googleFallback').hidden = true;
  }).catch(() => { $('#googleFallback').hidden = false; });
}

async function logout() {
  await api('/api/auth/logout', {});
  state.user = null;
  renderHeader();
  closeModal($('#journeyModal'));
  toast('Logged out. See you soon!');
}

// ---------------- passport ----------------
async function openJourney() {
  if (!state.user) {
    state.afterAuth = () => openJourney();
    return openAuth('phone', 'Log in to see your Virasat passport.');
  }
  const body = $('#journeyBody');
  body.innerHTML = '<p>Loading your passport…</p>';
  openModal($('#journeyModal'));
  const r = await api('/api/progress');
  const visits = Object.fromEntries((r.data.visits || []).map((v) => [v.city, v]));
  const quizzes = Object.fromEntries((r.data.quizzes || []).map((q) => [q.city, q]));
  const read = (cityId) => (r.data.covered || []).filter((x) => x.city === cityId).length;
  const u = state.user;
  const joined = new Date((u.createdAt || '').replace(' ', 'T') + 'Z');
  const via = { email: 'Email', phone: 'Phone', google: 'Google' };
  body.innerHTML = `
    <div class="pp-who">
      <div class="av">${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc(u.name[0]?.toUpperCase() || 'V')}</div>
      <div><b>${esc(u.name)}</b><small>${esc(u.email || u.phone || '')}<br>Signed in with ${u.via.map((v) => via[v]).join(', ') || '—'}${isNaN(joined) ? '' : ` · joined ${joined.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}</small></div>
    </div>
    <div class="pp-points"><b>${Number(r.data.points || 0)}</b> points
      <small>10 for each new city · 5 for each part of a letter you read · 10 for each correct answer on your best quiz</small></div>
    <div class="pp-stamps">${Object.values(CITIES).map((c) => {
      const v = visits[c.id], q = quizzes[c.id];
      return `<div class="pp-slot ${v ? '' : 'empty'}">
        <img src="${c.stamp}" alt="${esc(c.name)} stamp">
        <b>${esc(c.name)}</b>
        <small>${v ? `Opened ${v.count} time${v.count > 1 ? 's' : ''}` : 'Not visited yet'}<br>Read ${read(c.id)} of ${c.sections.length} parts<br>${q ? `Best quiz: ${q.best}/${q.total}` : 'Quiz not taken'}</small>
      </div>`;
    }).join('')}</div>
    <div class="pp-actions">
      ${Object.values(CITIES).map((c) => `<button class="btn primary" data-go="${c.id}">Visit ${esc(c.name)}</button>`).join('')}
      ${['editor', 'admin'].includes(u.role) ? '<a class="btn" href="/admin">Editor page</a>' : ''}
      <button class="btn" id="logoutBtn">Log out</button>
    </div>`;
  $$('[data-go]', body).forEach((b) => b.addEventListener('click', () => closeModal($('#journeyModal')), { capture: true }));
  $('#logoutBtn').onclick = logout;
}

// ---------------- boot ----------------
async function boot() {
  const cities = await api('/api/cities');
  if (!cities.ok) {
    document.body.insertAdjacentHTML('afterbegin', '<p class="load-error">Virasat could not load right now. Please refresh the page.</p>');
    return;
  }
  CITIES = Object.fromEntries(cities.data.cities.map((c) => [c.id, c]));
  setupChrome();
  setupStreet();
  setupAuth();
  const [cfg, me] = await Promise.all([api('/api/config'), api('/api/me')]);
  if (cfg.ok) state.config = cfg.data;
  if (me.ok && me.data.user) state.user = me.data.user;
  renderHeader();
  settleHeadline();
  setTimeout(() => say(state.user ? `Namaste, ${firstName(state.user.name)}! Where shall we go?` : "Namaste! I'm Gaju. Where shall we go?", 0), 400);
}
boot();
