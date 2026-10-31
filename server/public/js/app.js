import { buildScene, grain, VB, GATES } from './scene.js';
import { initCity, openCity } from './city.js';
import { stampHTML } from './stamps.js';
import { initClasses, openJoin } from './classes.js';
import { $, $$, sleep, clamp, esc, reduced, api } from './lib.js';
import { makeSound } from './sound.js';
import { initPassport, openJourney, openRecall, checkFading, openFadingRecall } from './passport.js';
// City content comes from the database through the API (/api/cities), loaded in boot().
let CITIES = {};

// two frames so a class change animates; capped because frames never come in a background tab
const nextFrame = () => Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), new Promise((r) => setTimeout(r, 60))]);
const firstName = (n) => String(n || '').split(' ')[0] || 'Explorer';

const state = { user: null, config: { googleClientId: null, smsMode: 'demo' }, busy: false, city: null, seq: 0, afterAuth: null, sound: false, fast: false };

// Cities you have already flown into get the short version of the arrival: same beats, much faster.
const WALK = 150; // Gaju's walking speed, in street units per second
const SEEN_KEY = 'virasat.seen';
const seen = (() => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } })();
function markSeen(id) {
  seen.add(id);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* private mode: fine */ }
}

// Show "+10 points" when the server says something earned points.
function showEarned(r) {
  if (r?.ok && r.data.stamp && state.city) toast(`${CITIES[state.city].name} stamp pressed into your passport!${r.data.earned > 0 ? ` +${r.data.earned} points` : ''}`);
  else if (r?.ok && r.data.earned > 0) toast(`+${r.data.earned} points · ${r.data.points} in total`);
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
const sound = makeSound(() => state.sound);

// ---------------- ticker, drawer, header ----------------
// Greetings from across India scroll in the top bar. They come from the database (checked by the
// team like facts); until some are verified, the bar shows the site's own lines instead.
// so the browser picks the right shaping and font for each script
const LANG_CODES = { hindi: 'hi', tamil: 'ta', bengali: 'bn', rajasthani: 'raj', kannada: 'kn', punjabi: 'pa', telugu: 'te', gujarati: 'gu', marathi: 'mr', malayalam: 'ml', urdu: 'ur', odia: 'or', assamese: 'as', ladakhi: 'lbj', bhutia: 'sip' };
const langCode = (l = '') => LANG_CODES[l.toLowerCase().split(/[ (]/)[0]] || '';

async function setupTicker() {
  const star = `<svg viewBox="0 0 32 32"><g fill="#8a4b1c">${Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45} 16 16)" d="M16 16 L14 4 Q16 1 18 4 Z"/>`).join('')}<circle cx="16" cy="16" r="3.2" fill="#5a2e10"/></g></svg>`;
  const r = await api('/api/greetings');
  const greetings = [...(r.ok ? r.data.greetings : []), ...(state.demo?.greetings || [])];
  const items = greetings.length
    ? greetings.map((g) => `${g.native ? `<b class="native" lang="${esc(langCode(g.language))}">${esc(g.native)}</b>` : ''}<b class="latin">${esc(g.word)}</b>`)
    : ['Walk into two cities with Gaju the elephant', 'Udaipur · City of Lakes', 'Kolkata · On the Hooghly', 'Collect stamps in your Virasat passport', 'Learn · Play · Explore'].map(esc);
  const run = items.map((t) => `<span>${t} ${star}</span>`).join('');
  const track = $('#ticker');
  track.classList.toggle('greetings', greetings.length > 0);
  // the other scripts' fonts load only when greetings in those scripts are live
  if (greetings.some((g) => g.native) && !$('#scriptFonts')) {
    document.head.insertAdjacentHTML('beforeend', '<link id="scriptFonts" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anek+Tamil:wght@600&family=Anek+Kannada:wght@600&family=Anek+Telugu:wght@600&family=Anek+Malayalam:wght@600&family=Anek+Gujarati:wght@600&family=Anek+Gurmukhi:wght@600&family=Anek+Odia:wght@600&display=swap">');
  }
  track.innerHTML = run + run;
  // keep the speed the same however many greetings there are
  track.style.animationDuration = `${Math.max(30, track.scrollWidth / 2 / 70)}s`;
}

function setupChrome() {
  setupTicker();
  $('#year').textContent = new Date().getFullYear();

  const drawer = $('#drawer'), scrim = $('#scrim');
  const open = () => { drawer.classList.add('open'); scrim.classList.add('show'); drawer.inert = false; drawer.setAttribute('aria-hidden', 'false'); };
  // inert as soon as it starts closing, so a tap meant for the street never lands on a sliding link
  window.closeDrawer = () => { drawer.classList.remove('open'); scrim.classList.remove('show'); drawer.inert = true; drawer.setAttribute('aria-hidden', 'true'); };
  drawer.inert = true;
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
      if (op.dataset.open === 'class') openJoin();
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
  // In a city, PageDown / Space / → move down a screen and PageUp / ← move back: classroom clickers send these.
  document.addEventListener('keydown', (e) => {
    const view = $('#city');
    if (view.hidden || !$('#kit').hidden || $$('.modal').some((m) => !m.hidden) || e.target.closest('input, textarea, select, button, a')) return;
    const down = ['PageDown', ' ', 'ArrowRight'].includes(e.key) && !e.shiftKey, up = ['PageUp', 'ArrowLeft'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    if (!down && !up) return;
    e.preventDefault();
    view.scrollBy({ top: (down ? 1 : -1) * innerHeight * 0.85, behavior: reduced() ? 'auto' : 'smooth' });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = $$('.modal').find((x) => !x.hidden);
    if (m) closeModal(m);
    else if (!$('#city').hidden) $('#cityBack').click();
    else closeDrawer();
  });
}

function renderHeader() {
  const btn = $('#accountBtn'), av = $('#accountAvatar');
  btn.querySelector('.initial')?.remove();
  // signed in, the initial opens the passport, so the separate passport button would only repeat it
  $('#journeyBtn').hidden = !!state.user;
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
      <div class="gaju-body"><span class="gaju-waddle"><img class="gaju-img" src="assets/gaju.webp" alt="" width="418" height="301"></span></div>
    </div>`);
  scene.layers = layers;
  $$('.gate', world).forEach((g) => g.addEventListener('click', () => goToCity(g.dataset.city)));

  const gaju = $('#gaju');
  const tell = () => {
    if (state.busy) return;
    if (openFadingRecall()) return;
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
    if (!hinted) { hinted = true; setTimeout(() => hint.classList.add('gone'), 2500); }
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

// Pins and stamps need the cities from the database, so they arrive after the street is drawn.
function addPins() {
  const pins = [['udaipur', 'u', GATES.udaipur, 168, 'Udaipur'], ['kolkata', 'k', GATES.kolkata + 100, 178, 'Kolkata']];
  scene.layers.buildings.insertAdjacentHTML('beforeend', pins.filter(([id]) => CITIES[id]).map(([id, cls, x, y, label]) => `
    <button class="pin ${cls}" data-go="${id}" style="left:${(x / VB.w) * 100}%;top:${(y / VB.h) * 100}%" aria-label="Walk to ${label}">
      <span class="pin-face">${stampHTML(CITIES[id])}</span><span class="pin-label">${label}</span>
    </button>`).join(''));
  $$('[data-stamp]').forEach((el) => { if (CITIES[el.dataset.stamp]) el.innerHTML = stampHTML(CITIES[el.dataset.stamp]); });
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
    scene.gx += dir * WALK * (state.fast ? 5 : 1) * dt;
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
  const stageX = (W - ww) / 2 + scene.cam;
  $('#stage').style.transform = `translateX(${stageX}px)`;
  // On narrow screens a gate can be off the edge; keep its pin on screen, pointing the way.
  for (const pin of $$('.pin')) {
    pin._half ||= pin.offsetWidth / 2 + 10;
    const x = stageX + (parseFloat(pin.style.left) / 100) * ww, half = pin._half;
    const shift = clamp(x, half, W - half) - x;
    pin.style.marginLeft = shift + 'px';
    pin.classList.toggle('edge-l', shift > 1);
    pin.classList.toggle('edge-r', shift < -1);
  }
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
  if (reduced()) { scene.gx = x; gaju.style.left = (x / VB.w) * 100 + '%'; return Promise.resolve(); }
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
    }, (Math.abs(x - scene.gx) / (WALK * (state.fast ? 5 : 1))) * 1000 + 400);
    scene.walk = { to: x, done };
  });
}

// The arrival is one shot: Gaju walks to the gate, the camera pushes in, and the city opens inside the
// gate's arch. Skip runs the same shot at about five times the speed; every other visit plays at full speed.
const pace = (ms) => sleep(ms * (state.fast ? 0.18 : 1));
function speedUp() {
  state.fast = true;
  $('#skipBtn').hidden = true;
  document.getAnimations().forEach((a) => { if (a.playState === 'running') a.playbackRate = 5; });
}
function sequenceDone() { state.fast = false; $('#skipBtn').hidden = true; }

// Each city has its own address (/udaipur), so it can be shared, bookmarked and left with the back button.
const cityInPath = () => { const id = location.pathname.replace(/^\/|\/$/g, ''); return CITIES[id] ? id : null; };
const HOME_TITLE = document.title;
function setAddress(city) {
  const path = (city ? `/${city}` : '/') + location.search;
  if (location.pathname + location.search !== path) history.pushState({ city }, '', path);
  document.title = city ? `${CITIES[city].name} · Virasat` : HOME_TITLE;
}

async function goToCity(city, { quick = false } = {}) {
  if (!CITIES[city] || state.busy) return;
  state.busy = true;
  const my = ++state.seq;
  const c = CITIES[city];
  setAddress(city);
  // every visit plays at full, unhurried speed; only the Skip button hurries it
  state.fast = false;
  $('#skipBtn').hidden = state.fast || reduced();
  $('#dragHint')?.classList.add('gone'); // Skip takes that corner
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
  await pace(1500);
  if (my !== state.seq) return;
  // push the camera into the gate; the city opens in the arch while the push is still going
  $('#street').classList.add('zooming');
  scene.poxT = (GATES[city] / VB.w) * 100;
  scene.poyT = ((city === 'udaipur' ? 470 : 460) / VB.h) * 100;
  scene.zoomT = 1050;
  scene.rxT = scene.ryT = 0;
  await pace(reduced() ? 300 : 1100);
  if (my !== state.seq) return;
  const portal = $(`#gate-${city} .portal`)?.getBoundingClientRect();
  const from = portal && portal.width > 4 ? { x: portal.left, y: portal.top, w: portal.width, h: portal.height } : null;
  openCity(city, my, from);
  await pace(2000);
  if (my === state.seq) scene.running = false; // the street is hidden behind the city; let it rest
}

function resetStreet() {
  startLoop();
  const street = $('#street');
  street.classList.remove('zooming');
  scene.zoomT = 0; scene.poxT = 50; scene.poyT = 50;
  $('#callout').classList.remove('away');
  document.body.classList.remove('locked');
  state.busy = false;
  sequenceDone();
  setAddress(null);
  setTimeout(() => say('Where to next?', 3500), 600);
}

// ---------------- auth ----------------
function openModal(m) {
  m.hidden = false;
  document.body.classList.add('locked');
  setTimeout(() => m.querySelector('input:not([type=hidden]), button')?.focus(), 60);
}
function closeModal(m) {
  m.hidden = true;
  if ($('#city').hidden) document.body.classList.remove('locked');
}

function setAuthTab(tab) {
  $$('#authModal .tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === tab));
  $$('#authModal .pane').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
  $('#authError').textContent = '';
  $('#authTitle').textContent = tab === 'signup' ? 'Sign your passport' : 'Welcome back';
}

function openAuth(tab = 'phone', reason) {
  // the live site has no real SMS yet, so phone login is switched off there (smsMode 'off')
  const phoneOn = state.config.smsMode !== 'off';
  $('#authModal .tab[data-tab="phone"]').hidden = !phoneOn;
  if (tab === 'phone' && !phoneOn) tab = 'login';
  setAuthTab(tab === 'signup' ? 'signup' : tab === 'login' ? 'login' : 'phone');
  $('#authSub').textContent = reason || 'Sign your passport and Virasat keeps your stamps, seals and points on any device.';
  openModal($('#authModal'));
  renderGoogle();
}

function onAuthed(user, isNew) {
  state.user = user;
  renderHeader();
  closeModal($('#authModal'));
  $('#checkpoint').hidden = true;
  checkFading();
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
  // No Google client ID yet: hide the button rather than offer one that only shows an error.
  $('#authModal .or').hidden = !id;
  if (!id) { $('#googleFallback').hidden = true; return; }
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

// ---------------- boot ----------------
async function boot() {
  // Draw the street at once: it needs no data. Everything from the server is asked for together.
  setupStreet();
  const [cities, cfg, me] = await Promise.all([api('/api/cities'), api('/api/config'), api('/api/me')]);
  if (!cities.ok) {
    document.body.insertAdjacentHTML('afterbegin', '<p class="load-error">Virasat could not load right now. Please refresh the page.</p>');
    return;
  }
  CITIES = Object.fromEntries(cities.data.cities.map((c) => [c.id, c]));
  // Demo mode (?demo in the address) also shows timeline events, greetings and places that are not checked yet.
  if (new URLSearchParams(location.search).has('demo')) {
    const d = await api('/api/demo');
    if (d.ok) {
      state.demo = d.data;
      for (const c of Object.values(CITIES)) {
        c.timeline = [...c.timeline, ...(d.data.timeline[c.id] || [])].sort((a, b) => (parseInt(a.year, 10) || 0) - (parseInt(b.year, 10) || 0));
        for (const s of c.sections) s.items.push(...(d.data.facts?.[c.id]?.[s.id] || []));
        c.quiz.push(...(d.data.quiz?.[c.id] || []));
      }
      document.body.insertAdjacentHTML('beforeend', '<div class="demo-badge" title="Shows content the team has not checked yet">Demo · includes drafts not yet checked</div>');
    }
  }
  addPins();
  setupChrome();
  setupAuth();
  initCity({ state, CITIES, api, sound, esc, firstName, openAuth, showEarned, goToCity, resetStreet, markSeen, sequenceDone });
  $('#skipBtn').onclick = speedUp;
  initPassport({ state, CITIES, openModal, closeModal, openAuth, logout, sound, showEarned, say });
  initClasses({ state, CITIES, api, esc, toast, openModal, closeModal, openJourney,
    onJoined: (d) => {
      if (d.user && !state.user) { state.user = d.user; renderHeader(); }
      toast(`You joined ${d.class.name}. Your teacher can see your stamps and scores.`);
    } });
  if (cfg.ok) state.config = cfg.data;
  if (me.ok && me.data.user) state.user = me.data.user;
  renderHeader();
  setTimeout(() => say(state.user ? `Namaste, ${firstName(state.user.name)}! Where shall we go?` : "Namaste! I'm Gaju. Where shall we go?", 0), 400);
  setTimeout(checkFading, 2600);
  // arriving on /udaipur (a shared link) walks straight into the city, in the short version
  const start = cityInPath();
  if (start) setTimeout(() => goToCity(start, { quick: true }), 500);
  addEventListener('popstate', () => {
    const id = cityInPath();
    if (!id && !$('#city').hidden) $('#cityBack').click();
    else if (id && $('#city').hidden) goToCity(id, { quick: true });
  });
}
boot();
