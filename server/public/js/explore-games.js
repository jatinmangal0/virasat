// Games about one city, made from its own checked content: where its places are, when its history happened,
// what its photos show, and which of its things are food, festivals or landmarks. A game only shows when the
// city has enough checked content for it. Best scores are kept on this device.
import { $, $$, clamp, reduced, sleep } from './lib.js';
import { fitCity, cityMapSVG, kmBetween } from './citymap.js';
import { cardsOf, toldPlaces, shuffle, pick, yearNum, store } from './explore-data.js';

let S;   // { ctx, run, panel, showTab } from explore.js

const GAMES = [
  { id: 'pin', icon: '📍', title: 'Pin it on the map', blurb: 'We name a place. You tap where it is in the city.', rounds: 5, max: 500, unit: 'points',
    ok: (d) => d.inFrame.length >= 5, play: playPin },
  { id: 'order', icon: '⏳', title: 'Time travel', blurb: 'Put four moments of history in order, oldest first.', rounds: 3, max: 12, unit: 'in the right place',
    ok: (d) => new Set(d.events.map((e) => yearNum(e.year))).size >= 8, play: playOrder },
  { id: 'picture', icon: '🖼️', title: 'Picture this', blurb: 'Look at the photo. Which of the four is it?', rounds: 8, max: 8, unit: 'right',
    ok: (d) => d.photos.length >= 8, play: playPicture },
  { id: 'memory', icon: '🃏', title: 'Memory pairs', blurb: 'Turn two cards at a time. Match each photo to its name.', rounds: 6, max: null, unit: 'moves',
    ok: (d) => d.photos.length >= 6, play: playMemory },
  { id: 'sort', icon: '🧺', title: 'Sort the city', blurb: 'Is it food, a festival or a landmark? Drop it in the right basket.', rounds: 9, max: 9, unit: 'right',
    ok: (d) => d.baskets.length >= 2, play: playSort },
];

export async function renderGames(shared) {
  S = shared;
  const { panel, run } = S;
  panel.innerHTML = '<p class="ex-note">Setting up the games…</p>';
  await run.ready;
  if (S.run.tab !== 'games' || S.panel !== panel) return;
  run.gameData = gameData(run);
  if (run.game) { const g = GAMES.find((x) => x.id === run.game); if (g?.ok(run.gameData)) return start(g); }
  drawHub();
}

// Everything the games draw on, gathered once.
function gameData(run) {
  const cards = cardsOf(run);
  const places = toldPlaces(run);
  const frame = fitCity(run.c, 100, 100);
  const inFrame = frame ? places.filter((p) => frame.project(p.longitude, p.latitude)) : [];
  // photos: facts with a photo (by their title) and written-up places with a photo (by their name)
  const seen = new Set();
  const photos = [
    ...cards.filter((x) => x.img && x.deck !== 'history').map((x) => ({ name: x.title, img: x.img, kind: x.deck, credit: x.credit })),
    ...places.filter((p) => p.photo).map((p) => ({ name: p.name, img: p.photo.src, kind: 'place', credit: p.image_license || 'Wikimedia Commons' })),
  ].filter((x) => { const k = x.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const baskets = run.c.sections.filter((s) => s.id !== 'facts' && s.items.length >= 2)
    .map((s) => ({ id: s.id, label: s.label, icon: s.icon, items: s.items }));
  return { cards, places, inFrame, photos, events: (run.history || []).filter((e) => yearNum(e.year)), baskets };
}

const bestKey = (g) => `games.${S.run.id}.${g.id}`;

function drawHub() {
  const { esc } = S.ctx, d = S.run.gameData;
  S.run.game = null;
  const ready = GAMES.filter((g) => g.ok(d));
  S.panel.innerHTML = ready.length ? `
    <p class="gm-intro">Five quick games about ${esc(S.run.c.name)}, made from the same checked facts as the letter.</p>
    <div class="gm-hub">${ready.map((g) => {
      const best = store(bestKey(g));
      return `<button class="gm-tile" data-game="${g.id}">
        <span class="gm-icon" aria-hidden="true">${g.icon}</span>
        <b>${esc(g.title)}</b><span>${esc(g.blurb)}</span>
        <small>${best != null ? `Your best: ${best}${g.max ? ` of ${g.max}` : ''} ${g.unit}` : 'Not played yet'}</small></button>`;
    }).join('')}</div>`
    : `<p class="ex-note">${esc(S.run.c.name)}'s games open once a few more facts are checked.</p>`;
  $$('.gm-tile', S.panel).forEach((b) => b.addEventListener('click', () => { S.ctx.sound?.tap(); start(GAMES.find((g) => g.id === b.dataset.game)); }));
}

// The frame every game sits in: a title bar with the round and the score, and the game's own area.
function start(g) {
  const { esc } = S.ctx;
  S.run.game = g.id;
  S.run.onLeave?.();
  S.run.onLeave = S.run.onResize = null;
  S.panel.innerHTML = `
    <div class="gm-bar">
      <button class="post-back gm-back" id="gmBack">← All games</button>
      <h2><span aria-hidden="true">${g.icon}</span> ${esc(g.title)}</h2>
      <p class="gm-score" id="gmScore" aria-live="polite"></p>
    </div>
    <div class="gm-area" id="gmArea"></div>`;
  $('#gmBack').addEventListener('click', () => { S.run.onLeave?.(); S.run.onLeave = S.run.onResize = null; drawHub(); });
  const token = {};
  S.run.playing = token;
  g.play({
    area: $('#gmArea'),
    alive: () => S.run?.playing === token && S.run.tab === 'games' && !!$('#gmArea'),
    score: (text) => { $('#gmScore').textContent = text; },
    finish: (score, { lowerIsBetter = false, line = '' } = {}) => finish(g, score, lowerIsBetter, line),
  });
}

function finish(g, score, lowerIsBetter, line) {
  const { esc, sound } = S.ctx;
  const old = store(bestKey(g));
  const better = old == null || (lowerIsBetter ? score < old : score > old);
  if (better) store(bestKey(g), score);
  const share = g.max ? score / g.max : clamp(1 - (score - g.rounds) / (g.rounds * 1.5), 0, 1);
  const flowers = share >= 0.9 ? 3 : share >= 0.6 ? 2 : share >= 0.3 ? 1 : 0;
  $('#gmArea').innerHTML = `
    <div class="gm-end">
      <div class="gm-flowers" aria-label="${flowers} of 3 marigolds">${[0, 1, 2].map((k) => `<i class="${k < flowers ? 'on' : ''}" style="--d:${k * 0.2}s">✿</i>`).join('')}</div>
      <h3>${g.max ? `${score} of ${g.max}` : score} ${esc(g.unit)}</h3>
      <p>${esc(line)}${better && old != null ? ' A new best!' : old != null ? ` Your best is ${old}${g.max ? ` of ${g.max}` : ''}.` : ''}</p>
      <div class="gm-end-btns">
        <button class="btn primary" id="gmAgain">Play again</button>
        <button class="btn" id="gmHub">Other games</button>
        <button class="btn" id="gmCards">Learn with flashcards</button>
      </div>
    </div>`;
  if (flowers) sound?.thunk();
  $('#gmScore').textContent = '';
  $('#gmAgain').addEventListener('click', () => start(g));
  $('#gmHub').addEventListener('click', drawHub);
  $('#gmCards').addEventListener('click', () => S.showTab('cards'));
  $('#gmAgain').focus({ preventScroll: true });
}

const praise = (share) => (share >= 0.9 ? 'Shabash! You know this city.' : share >= 0.6 ? 'Well played!' : share >= 0.3 ? 'A good start. Try again to beat it.' : 'Every explorer starts somewhere. Have a look at the flashcards, then try again.');

// ---------- 1. Pin it on the map ----------
// A place is named (with its photo); the player taps where they think it is. The real spot is then shown,
// with the distance, and up to 100 points: full marks within a few hundred metres, none at a third of the city away.
async function playPin({ area, alive, score, finish }) {
  const { esc, sound } = S.ctx, c = S.run.c;
  const rounds = pick(S.run.gameData.inFrame, 5);
  let total = 0;
  area.innerHTML = `
    <div class="pin-ask" id="pinAsk"></div>
    <div class="gm-map" id="pinMap"><svg class="ex-svg" id="pinSvg" aria-hidden="true"></svg><div class="pin-marks" id="pinMarks"></div></div>
    <p class="gm-help" id="pinHelp">Tap the map where you think it is.</p>`;
  const box = $('#pinMap');
  let m;
  const draw = () => {
    m = fitCity(c, box.clientWidth, box.clientHeight);
    if (!m) return;
    $('#pinSvg').setAttribute('viewBox', `0 0 ${m.W} ${m.H}`);
    // the drawn map, not the street map: the street map's place names would give the answer away
    $('#pinSvg').innerHTML = cityMapSVG(m, esc, { id: 'pin' });
  };
  draw();
  S.run.onResize = () => { if (alive()) { draw(); placeMarks(); } };
  let marks = [];
  const placeMarks = () => {
    $('#pinMarks').innerHTML = marks.map((k) => {
      const [x, y] = m.toXY(...k.at);
      return `<span class="pin-mark ${k.cls}" style="left:${x}px;top:${y}px">${k.label ? `<b>${esc(k.label)}</b>` : ''}</span>`;
    }).join('') + marks.filter((k) => k.line).map((k) => {
      const [a, b] = [m.toXY(...k.at), m.toXY(...k.line)];
      return `<svg class="pin-line" viewBox="0 0 ${m.W} ${m.H}"><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/></svg>`;
    }).join('');
  };
  for (let i = 0; i < rounds.length; i++) {
    const p = rounds[i];
    marks = []; placeMarks();
    score(`Place ${i + 1} of ${rounds.length} · ${total} points`);
    $('#pinAsk').innerHTML = `${p.photo ? `<img src="${esc(p.photo.src)}" alt="">` : ''}
      <div><small>Where is…</small><h3>${esc(p.name)}</h3><p>${esc(p.subcategory || 'Heritage place')}${p.year ? ` · ${esc(p.year)}` : ''}</p></div>`;
    $('#pinAsk img')?.addEventListener('error', (e) => e.target.remove());
    $('#pinHelp').textContent = 'Tap the map where you think it is.';
    box.classList.add('aim');
    const guess = await new Promise((resolve) => {
      const tap = (e) => {
        const r = box.getBoundingClientRect();
        box.removeEventListener('click', tap);
        resolve(m.fromXY(e.clientX - r.left, e.clientY - r.top));
      };
      box.addEventListener('click', tap);
      S.run.onLeave = () => box.removeEventListener('click', tap);
    });
    if (!alive()) return;
    box.classList.remove('aim');
    const real = [p.longitude, p.latitude], km = kmBetween(guess, real);
    const pts = Math.round(100 * clamp(1 - (km - 0.3) / (m.spanKm * 0.33), 0, 1));
    total += pts;
    marks = [{ at: guess, cls: 'guess', line: real }, { at: real, cls: 'real', label: p.name }];
    placeMarks();
    pts >= 60 ? sound?.ding() : sound?.buzz();
    const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
    const word = pts >= 90 ? 'Bullseye!' : pts >= 60 ? 'Very close!' : pts >= 30 ? 'Close.' : 'Quite far off.';
    $('#pinHelp').innerHTML = `<b>${word}</b> You were ${dist} away · <b>+${pts}</b> points
      ${p.description ? `<span class="pin-about">${esc(p.description)}</span>` : ''}
      <button class="btn primary" id="pinNext">${i === rounds.length - 1 ? 'See my score' : 'Next place'}</button>`;
    score(`Place ${i + 1} of ${rounds.length} · ${total} points`);
    $('#pinNext').focus({ preventScroll: true });
    await new Promise((resolve) => $('#pinNext').addEventListener('click', resolve, { once: true }));
    if (!alive()) return;
  }
  finish(total, { line: praise(total / 500) });
}

// ---------- 2. Time travel ----------
// Four events, shuffled. Tap them oldest first; tap a numbered one to take it back. Then check: the cards slide
// into the real order with their years, each marked right or wrong. Three rounds.
async function playOrder({ area, alive, score, finish }) {
  const { esc, sound } = S.ctx;
  const pool = shuffle(S.run.gameData.events);
  let total = 0;
  for (let round = 0; round < 3; round++) {
    // four events with different years, not used in an earlier round
    const set = [];
    for (let k = 0; k < pool.length && set.length < 4;) {
      if (set.some((x) => yearNum(x.year) === yearNum(pool[k].year))) k++;
      else set.push(...pool.splice(k, 1));
    }
    if (set.length < 4) break;
    score(`Round ${round + 1} of 3 · ${total} right so far`);
    const picks = [];
    area.innerHTML = `
      <p class="gm-help">Tap the events <b>oldest first</b>. Tap a numbered one to take it back.</p>
      <ol class="ord-list" id="ordList">${set.map((e, k) => `
        <li><button class="ord-card" data-k="${k}">
          <span class="ord-n" aria-hidden="true"></span>
          ${e.images?.[0]?.src ? `<img src="${esc(e.images[0].src.replace(/(\/image\/upload\/)/, '$1f_auto,q_auto,c_fill,w_160,h_160/'))}" alt="">` : '<span class="ord-dot" aria-hidden="true">⏳</span>'}
          <span class="ord-t"><b>${esc(e.title)}</b><small class="ord-year">${esc(e.year)}</small></span></button></li>`).join('')}</ol>
      <div class="gm-row"><button class="btn primary" id="ordCheck" disabled>Check the order</button></div>`;
    $$('#ordList img').forEach((img) => img.addEventListener('error', () => img.remove()));
    const btns = $$('.ord-card', area);
    const paint = () => {
      btns.forEach((b) => {
        const at = picks.indexOf(Number(b.dataset.k));
        b.classList.toggle('picked', at >= 0);
        $('.ord-n', b).textContent = at >= 0 ? at + 1 : '';
        b.setAttribute('aria-label', `${set[b.dataset.k].title}${at >= 0 ? `, number ${at + 1}` : ''}`);
      });
      $('#ordCheck').disabled = picks.length < set.length;
    };
    btns.forEach((b) => b.addEventListener('click', () => {
      const k = Number(b.dataset.k), at = picks.indexOf(k);
      if (at >= 0) picks.splice(at); else picks.push(k);
      sound?.tap();
      paint();
      if (picks.length === set.length) $('#ordCheck').focus({ preventScroll: true });
    }));
    paint();
    await new Promise((resolve) => $('#ordCheck').addEventListener('click', resolve, { once: true }));
    if (!alive()) return;
    // the right order, by year (and by the team's own order for the same year)
    const right = set.map((e, k) => k).sort((a, b) => yearNum(set[a].year) - yearNum(set[b].year));
    const good = picks.filter((k, i) => right[i] === k).length;
    total += good;
    good === set.length ? sound?.ding() : sound?.buzz();
    // slide the cards into the real order
    const list = $('#ordList'), before = new Map(btns.map((b) => [b, b.getBoundingClientRect().top]));
    right.forEach((k, i) => {
      const li = btns[k].parentNode;
      list.appendChild(li);
      btns[k].classList.add(picks[i] === k ? 'right' : 'wrong', 'shown');
      $('.ord-n', btns[k]).textContent = picks[i] === k ? '✓' : picks.indexOf(k) + 1;
      btns[k].disabled = true;
    });
    if (!reduced()) btns.forEach((b) => { const dy = before.get(b) - b.getBoundingClientRect().top; if (dy) b.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.3,.7,.2,1)' }); });
    score(`Round ${round + 1} of 3 · ${total} right so far`);
    $('.gm-help', area).innerHTML = good === set.length ? '<b>Perfect order!</b> Here they are with their years.'
      : `<b>${good} of ${set.length}</b> in the right place. Here is the real order, oldest at the top.`;
    $('#ordCheck').outerHTML = `<button class="btn primary" id="ordNext">${round === 2 ? 'See my score' : 'Next round'}</button>`;
    $('#ordNext').focus({ preventScroll: true });
    await new Promise((resolve) => $('#ordNext').addEventListener('click', resolve, { once: true }));
    if (!alive()) return;
  }
  finish(total, { line: praise(total / 12) });
}

// ---------- 3. Picture this ----------
// A photo of a landmark, a dish, a festival or a place; four names to choose from, the others picked from
// the same kind where possible (so a dish is mixed with other dishes).
async function playPicture({ area, alive, score, finish }) {
  const { esc, sound } = S.ctx, all = S.run.gameData.photos;
  const queue = shuffle(all);
  let right = 0;
  for (let i = 0; i < 8 && queue.length; i++) {
    const item = queue.shift();
    const same = shuffle(all.filter((x) => x !== item && x.kind === item.kind));
    const others = [...same, ...shuffle(all.filter((x) => x !== item && x.kind !== item.kind))].slice(0, 3);
    const opts = shuffle([item, ...others]);
    score(`Photo ${i + 1} of 8 · ${right} right`);
    area.innerHTML = `
      <figure class="pic-frame"><img id="picImg" src="${esc(item.img)}" alt="A photo from ${esc(S.run.c.name)}. Which one is it?">
        <figcaption>Photo: ${esc(item.credit)}</figcaption></figure>
      <p class="gm-help">Which one is in the photo?</p>
      <div class="q-opts pic-opts">${opts.map((o, k) => `<button class="q-opt" data-k="${k}">${esc(o.name)}</button>`).join('')}</div>
      <p class="gm-help" id="picSay"></p>`;
    // a photo that will not load is swapped for another one, without costing the player a turn
    const loaded = await new Promise((resolve) => {
      const img = $('#picImg');
      if (img.complete && img.naturalWidth) resolve(true);
      img.addEventListener('load', () => resolve(true), { once: true });
      img.addEventListener('error', () => resolve(false), { once: true });
    });
    if (!alive()) return;
    if (!loaded) { i--; continue; }
    const choice = await new Promise((resolve) => $$('.pic-opts .q-opt', area).forEach((b) => b.addEventListener('click', () => resolve(Number(b.dataset.k)))));
    if (!alive()) return;
    const ok = opts[choice] === item;
    if (ok) right++;
    const btns = $$('.pic-opts .q-opt', area);
    btns.forEach((b) => { b.disabled = true; });
    btns[choice].classList.add(ok ? 'right' : 'wrong');
    btns[opts.indexOf(item)].classList.add('right');
    ok ? sound?.ding() : sound?.buzz();
    score(`Photo ${i + 1} of 8 · ${right} right`);
    $('#picSay').innerHTML = `${ok ? '<b>Shabash!</b>' : `It is <b>${esc(item.name)}</b>.`} <button class="btn primary" id="picNext">${i === 7 || !queue.length ? 'See my score' : 'Next photo'}</button>`;
    $('#picNext').focus({ preventScroll: true });
    await new Promise((resolve) => $('#picNext').addEventListener('click', resolve, { once: true }));
    if (!alive()) return;
  }
  finish(right, { line: praise(right / 8) });
}

// ---------- 4. Memory pairs ----------
// Twelve cards face down: six photos and their six names. Turn two; a photo and its own name stay up.
// Fewer moves is better.
async function playMemory({ area, score, finish }) {
  const { esc, sound } = S.ctx;
  const six = pick(S.run.gameData.photos, 6);
  const deck = shuffle(six.flatMap((p, k) => [{ k, img: p.img, name: p.name }, { k, name: p.name }]));
  let moves = 0, found = 0, open = [], busy = false;
  score('0 moves · 0 of 6 pairs');
  area.innerHTML = `<p class="gm-help">Turn two cards. Find each photo's name.</p>
    <div class="mem-grid">${deck.map((d, i) => `
      <button class="mem-card" data-i="${i}" aria-label="Card ${i + 1}, face down">
        <span class="mem-in"><span class="mem-back" aria-hidden="true">✿</span>
        <span class="mem-face">${d.img ? `<img src="${esc(d.img)}" alt="${esc(d.name)}" loading="eager">` : `<b>${esc(d.name)}</b>`}</span></span></button>`).join('')}</div>`;
  $$('.mem-card img', area).forEach((img) => img.addEventListener('error', () => { img.outerHTML = `<b class="mem-alt">${esc(img.alt)} 📷</b>`; }));
  const cards = $$('.mem-card', area);
  await new Promise((resolve) => cards.forEach((b) => b.addEventListener('click', async () => {
    const i = Number(b.dataset.i);
    if (busy || b.classList.contains('up') || b.classList.contains('done')) return;
    b.classList.add('up');
    b.setAttribute('aria-label', `${deck[i].img ? 'Photo of' : 'Name:'} ${deck[i].name}`);
    sound?.paper();
    open.push(i);
    if (open.length < 2) return;
    moves++;
    const [a, c] = open;
    open = [];
    if (deck[a].k === deck[c].k) {
      found++;
      [a, c].forEach((x) => cards[x].classList.add('done'));
      sound?.ding();
    } else {
      busy = true;
      await sleep(900);
      [a, c].forEach((x) => { cards[x].classList.remove('up'); cards[x].setAttribute('aria-label', `Card ${x + 1}, face down`); });
      busy = false;
    }
    score(`${moves} moves · ${found} of 6 pairs`);
    if (found === 6) { await sleep(700); resolve(); }
  })));
  if (!$('#gmArea')) return;
  finish(moves, { lowerIsBetter: true, line: moves <= 9 ? 'What a memory!' : moves <= 13 ? 'Well played!' : 'All pairs found. Try again in fewer moves.' });
}

// ---------- 5. Sort the city ----------
// One thing at a time: tap its basket (Landmarks, Festivals & Arts, Food). Nine things.
async function playSort({ area, alive, score, finish }) {
  const { esc, sound } = S.ctx, baskets = S.run.gameData.baskets;
  const per = Math.ceil(9 / baskets.length);
  const items = shuffle(baskets.flatMap((b) => pick(b.items, per).map((f) => ({ ...f, basket: b.id })))).slice(0, 9);
  let right = 0;
  area.innerHTML = `
    <div class="sort-item" id="sortItem" aria-live="polite"></div>
    <div class="sort-baskets">${baskets.map((b) => `
      <button class="sort-basket" data-b="${b.id}"><span class="sb-icon" aria-hidden="true">${b.icon}</span><b>${esc(b.label)}</b><small class="sb-n">0</small></button>`).join('')}</div>
    <p class="gm-help" id="sortSay">Which basket does it go in?</p>`;
  const counts = {};
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    score(`${i + 1} of ${items.length} · ${right} right`);
    $('#sortItem').innerHTML = `${it.image?.src ? `<img src="${esc(it.image.src.replace(/(\/image\/upload\/)/, '$1f_auto,q_auto,c_fill,w_240,h_240/'))}" alt="">` : ''}<div><h3>${esc(it.title)}</h3></div>`;
    $('#sortItem img')?.addEventListener('error', (e) => e.target.remove());
    $('#sortItem').animate?.([{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }], { duration: reduced() ? 0 : 260 });
    const bs = $$('.sort-basket', area);
    bs.forEach((b) => { b.disabled = false; b.classList.remove('right', 'wrong'); });
    const choice = await new Promise((resolve) => bs.forEach((b) => { b.onclick = () => resolve(b.dataset.b); }));
    if (!alive()) return;
    const ok = choice === it.basket;
    if (ok) right++;
    bs.forEach((b) => { b.disabled = true; b.onclick = null; });
    const home = bs.find((b) => b.dataset.b === it.basket);
    home.classList.add('right');
    if (!ok) bs.find((b) => b.dataset.b === choice).classList.add('wrong');
    counts[it.basket] = (counts[it.basket] || 0) + 1;
    $('.sb-n', home).textContent = counts[it.basket];
    ok ? sound?.ding() : sound?.buzz();
    $('#sortSay').innerHTML = `${ok ? '<b>Right!</b>' : `It goes in <b>${esc(baskets.find((b) => b.id === it.basket).label)}</b>.`} ${esc(it.text)}
      <button class="btn primary" id="sortNext">${i === items.length - 1 ? 'See my score' : 'Next'}</button>`;
    score(`${i + 1} of ${items.length} · ${right} right`);
    $('#sortNext').focus({ preventScroll: true });
    await new Promise((resolve) => $('#sortNext').addEventListener('click', resolve, { once: true }));
    if (!alive()) return;
    $('#sortSay').textContent = 'Which basket does it go in?';
  }
  finish(right, { line: praise(right / items.length) });
}
