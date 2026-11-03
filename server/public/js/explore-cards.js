// Flashcards: one card for every checked fact and every event in the city's history. Pick a deck, tap the card
// to turn it over, then "Got it" or "Again" (again-cards come back later in the round). Swipe right or left
// on a phone; Space, → and ← on a keyboard. The cards you know are remembered on this device.
import { $, $$, reduced } from './lib.js';
import { motifSVG } from './motifs.js';
import { cardsOf, decksOf, shuffle, store } from './explore-data.js';

let S;   // { ctx, run, panel, showTab } from explore.js

export async function renderCards(shared) {
  S = shared;
  const { panel, run } = S;
  panel.innerHTML = '<p class="ex-note">Shuffling the cards…</p>';
  await run.ready;
  if (S.run.tab !== 'cards' || S.panel !== panel) return;
  const cards = cardsOf(run);
  if (!cards.length) { panel.innerHTML = `<p class="ex-note">${S.ctx.esc(run.c.name)}'s cards are still being checked.</p>`; return; }
  run.cards = { all: cards, deck: run.cards?.deck || 'all' };
  drawDecks();
  startRound();
  const key = (e) => {
    if (!run.cards?.round || e.target.closest('input, textarea, select, .ex-tabs, .fc-decks') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;   // a focused button answers for itself
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); answer(true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); answer(false); }
  };
  document.addEventListener('keydown', key);
  run.onLeave = () => document.removeEventListener('keydown', key);
}

const learnedKey = () => `cards.${S.run.id}`;
const learned = () => new Set(store(learnedKey()) || []);

function drawDecks() {
  const { esc } = S.ctx, st = S.run.cards, known = learned();
  const decks = decksOf(S.run, st.all);
  const count = (d) => st.all.filter((x) => d === 'all' || x.deck === d);
  S.panel.innerHTML = `
    <div class="fc-decks" role="group" aria-label="Choose a deck">
      ${[{ id: 'all', label: 'All cards', icon: '🗂️', n: st.all.length }, ...decks].map((d) => `
        <button class="chip fc-deck" data-deck="${d.id}" aria-pressed="${st.deck === d.id}">
          <span aria-hidden="true">${d.icon}</span>${esc(d.label)} <b>${count(d.id).filter((x) => known.has(x.id)).length}/${d.n}</b></button>`).join('')}
    </div>
    <div class="fc-stage" id="fcStage"></div>
    <p class="fc-help">Tap the card to turn it · <b>Got it</b> or <b>Again</b> · on a keyboard: Space, → and ←</p>`;
  $$('.fc-deck', S.panel).forEach((b) => b.addEventListener('click', () => { st.deck = b.dataset.deck; S.ctx.sound?.tap(); drawDecks(); startRound(); }));
}

function startRound(only) {
  const st = S.run.cards;
  const list = only || st.all.filter((x) => st.deck === 'all' || x.deck === st.deck);
  st.round = { queue: shuffle(list), total: list.length, done: 0, firstTry: 0, missed: new Set() };
  drawCard();
}

function drawCard() {
  const { esc } = S.ctx, st = S.run.cards, r = st.round, card = r.queue[0], stage = $('#fcStage');
  if (!card) return drawDone();
  const pct = Math.round((r.done / r.total) * 100);
  const art = card.img ? `<img src="${esc(card.img)}" alt="" loading="lazy">` : `<div class="fc-motif">${motifSVG(card.motif) || `<span>${card.icon}</span>`}</div>`;
  stage.innerHTML = `
    <div class="fc-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
    <p class="fc-count">Card ${r.done + 1} of ${r.total}${r.missed.size ? ` · ${r.missed.size} to practise` : ''}</p>
    <div class="fc-card" id="fcCard" role="button" tabindex="0" aria-pressed="false" aria-label="${esc(card.title)}. Tap to turn the card over.">
      <div class="fc-inner">
        <div class="fc-face fc-front">
          <div class="fc-art">${art}</div>
          <p class="fc-kicker"><span aria-hidden="true">${card.icon}</span> ${esc(card.deckLabel)}</p>
          <h3>${esc(card.title)}</h3>
          <p class="fc-ask">${card.year ? 'When did this happen? Turn over to see.' : 'What do you know about it? Turn over to see.'}</p>
        </div>
        <div class="fc-face fc-back" aria-live="polite">
          ${card.year ? `<p class="fc-year">${esc(card.year)}</p>` : `<p class="fc-kicker"><span aria-hidden="true">${card.icon}</span> ${esc(card.title)}</p>`}
          <p class="fc-text">${esc(card.text)}</p>
          <p class="fc-foot">${card.src ? `<a href="${esc(card.src)}" target="_blank" rel="noopener">Source</a>` : ''}
            ${card.credit ? `<span>${card.page ? `<a href="${esc(card.page)}" target="_blank" rel="noopener">Photo: ${esc(card.credit)}</a>` : esc(card.credit)}</span>` : ''}</p>
        </div>
      </div>
    </div>
    <div class="fc-actions">
      <button class="btn fc-again" id="fcAgain">↺ Again</button>
      <button class="btn fc-flip" id="fcFlip">Turn over</button>
      <button class="btn primary fc-got" id="fcGot">Got it ✓</button>
    </div>`;
  const el = $('#fcCard');
  $('img', el)?.addEventListener('error', (e) => { e.target.parentNode.innerHTML = `<div class="fc-motif">${motifSVG(card.motif) || `<span>${card.icon}</span>`}</div>`; });
  el.addEventListener('click', (e) => { if (!e.target.closest('a')) flip(); });
  el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); flip(); } });
  $('#fcFlip').addEventListener('click', flip);
  $('#fcGot').addEventListener('click', () => answer(true));
  $('#fcAgain').addEventListener('click', () => answer(false));
  swipe(el);
}

function flip() {
  const el = $('#fcCard');
  if (!el) return;
  const on = !el.classList.contains('flipped');
  el.classList.toggle('flipped', on);
  el.setAttribute('aria-pressed', on);
  $('#fcFlip').textContent = on ? 'Turn back' : 'Turn over';
  S.ctx.sound?.paper();
}

// Right: I knew it. Left: show me again later in this round.
function answer(knew) {
  const st = S.run.cards, r = st.round, card = r.queue[0], el = $('#fcCard');
  if (!card || !el || el.dataset.gone) return;
  el.dataset.gone = '1';
  const known = learned();
  if (knew) {
    r.queue.shift(); r.done++;
    if (!r.missed.has(card.id)) r.firstTry++;
    known.add(card.id);
    S.ctx.sound?.ding();
  } else {
    r.missed.add(card.id);
    r.queue.shift();
    r.queue.splice(Math.min(r.queue.length, 3 + Math.floor(Math.random() * 3)), 0, card);   // back in a few cards
    known.delete(card.id);
    S.ctx.sound?.tap();
  }
  store(learnedKey(), [...known]);
  updateDeckCounts();
  const go = () => drawCard();
  if (reduced()) return go();
  el.style.transition = 'transform .32s ease-in, opacity .32s';
  el.style.transform = `translateX(${knew ? 120 : -120}%) rotate(${knew ? 14 : -14}deg)`;
  el.style.opacity = '0';
  setTimeout(go, 300);
}

function updateDeckCounts() {
  const known = learned(), st = S.run.cards;
  $$('.fc-deck', S.panel).forEach((b) => {
    const list = st.all.filter((x) => b.dataset.deck === 'all' || x.deck === b.dataset.deck);
    $('b', b).textContent = `${list.filter((x) => known.has(x.id)).length}/${list.length}`;
  });
}

// Drag the card sideways: past a third of its width it counts as Got it (right) or Again (left).
function swipe(el) {
  let x0 = null, y0 = 0, dx = 0, id = null;
  el.addEventListener('pointerdown', (e) => { if (e.button) return; x0 = e.clientX; y0 = e.clientY; dx = 0; id = e.pointerId; });
  el.addEventListener('pointermove', (e) => {
    if (x0 === null || e.pointerId !== id) return;
    dx = e.clientX - x0;
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - y0)) return;
    el.style.transition = 'none';
    el.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
    el.classList.toggle('lean-got', dx > 40); el.classList.toggle('lean-again', dx < -40);
  });
  const end = () => {
    if (x0 === null) return;
    x0 = null;
    const far = Math.abs(dx) > el.offsetWidth / 3;
    if (far) { el.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true }); answer(dx > 0); return; }
    if (Math.abs(dx) >= 8) el.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true });
    el.style.transition = 'transform .25s'; el.style.transform = '';
    el.classList.remove('lean-got', 'lean-again');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.style.touchAction = 'pan-y';
}

function drawDone() {
  const { esc } = S.ctx, st = S.run.cards, r = st.round;
  const missed = st.all.filter((x) => r.missed.has(x.id));
  const all = r.firstTry === r.total;
  $('#fcStage').innerHTML = `
    <div class="fc-done">
      <div class="fc-done-mark" aria-hidden="true">${all ? '🏅' : '🌼'}</div>
      <h3>${all ? 'Every card, first time!' : 'Deck done!'}</h3>
      <p>You knew <b>${r.firstTry}</b> of ${r.total} cards straight away${missed.length ? `, and practised ${missed.length} until you had them` : ''}.</p>
      <div class="fc-done-btns">
        ${missed.length ? '<button class="btn primary" id="fcMissed">Practise the tricky ones</button>' : ''}
        <button class="btn" id="fcAgainAll">Shuffle and go again</button>
        <button class="btn" id="fcGames">Play a game about ${esc(S.run.c.name)} →</button>
      </div>
    </div>`;
  S.ctx.sound?.thunk();
  $('#fcMissed')?.addEventListener('click', () => startRound(missed));
  $('#fcAgainAll').addEventListener('click', () => startRound());
  $('#fcGames').addEventListener('click', () => S.showTab('games'));
  st.round = null;
}
