// Games about one city, made from its own checked content: what its photos show, and which of its things are
// food, festivals or landmarks. (Pin it on the map and Time travel were taken out on 5 Nov.) A game only shows when the
// city has enough checked content for it. Best scores are kept on this device.
import { $, $$, clamp, reduced, sleep } from './lib.js';
import { cardsOf, toldPlaces, shuffle, pick, store } from './explore-data.js';

let S;   // { ctx, run, panel, showTab } from explore.js

const GAMES = [
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
  // photos: facts with a photo (by their title) and written-up places with a photo (by their name)
  const seen = new Set();
  const photos = [
    ...cards.filter((x) => x.img && x.deck !== 'history').map((x) => ({ name: x.title, img: x.img, kind: x.deck, credit: x.credit })),
    ...places.filter((p) => p.photo).map((p) => ({ name: p.name, img: p.photo.src, kind: 'place', credit: p.image_license || 'Wikimedia Commons' })),
  ].filter((x) => { const k = x.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const baskets = run.c.sections.filter((s) => s.id !== 'facts' && s.items.length >= 2)
    .map((s) => ({ id: s.id, label: s.label, icon: s.icon, items: s.items }));
  return { cards, places, photos, baskets };
}

const bestKey = (g) => `games.${S.run.id}.${g.id}`;

function drawHub() {
  const { esc } = S.ctx, d = S.run.gameData;
  S.run.game = null;
  const ready = GAMES.filter((g) => g.ok(d));
  S.panel.innerHTML = ready.length ? `
    <p class="gm-intro">Three quick games about ${esc(S.run.c.name)}, made from the same checked facts as the letter.</p>
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

// ---------- 1. Picture this ----------
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

// ---------- 2. Memory pairs ----------
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

// ---------- 3. Sort the city ----------
// One thing at a time, by name only (no photo): tap its basket (Landmarks, Festivals & Arts, Food). Nine things.
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
    // name only: a photo of the dish or the building would give the basket away (Jatin, 5 Nov)
    $('#sortItem').innerHTML = `<div><h3>${esc(it.title)}</h3></div>`;
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
