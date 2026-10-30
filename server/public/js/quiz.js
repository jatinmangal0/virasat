// "Seal the letter": up to five questions at the end of a city's letter, marked by the server (draft questions in
// demo mode carry their answer, since only editors see them). The score presses one, two or three wax seals.
import { $, $$ } from './lib.js';

// what city.js shares: its ctx, the open city (cur), relayout() after the letter's height changes, the seal marks
let ctx, cur, layoutAfterOpen, SEAL_MARK;
export function initQuiz(shared) { ({ ctx, cur, relayout: layoutAfterOpen, marks: SEAL_MARK } = shared); }

// Up to five questions, one at a time. Answers are marked by the server (drafts in demo mode carry their
// answer, since only editors can see them). The score presses one, two or three wax seals.
export function startQuiz(c) {
  const pool = [...c.quiz].sort(() => Math.random() - 0.5).slice(0, 5);
  cur().quiz = { pool, i: 0, picks: [], right: 0 };
  drawQuestion();
}

function drawQuestion() {
  const { esc } = ctx, q = cur().quiz, box = $('#sealq');
  const item = q.pool[q.i];
  box.innerHTML = `
    <div class="sealq-head"><div class="wax" aria-hidden="true">${SEAL_MARK[cur().id] || 'V'}</div>
      <div><h3>Seal the letter</h3><p>Answer to press ${esc(cur().c.name)}'s seal into the wax.</p></div></div>
    <div class="sealq-steps" aria-hidden="true">${q.pool.map((_, k) => `<i class="${k < q.i ? (q.picks[k].ok ? 'ok' : 'no') : k === q.i ? 'now' : ''}"></i>`).join('')}</div>
    <p class="q-text">${esc(item.q)}${item.draft ? '<span class="q-draft">draft</span>' : ''}</p>
    <div class="q-opts">${item.options.map((o, k) => `<button class="q-opt" data-k="${k}">${esc(o)}</button>`).join('')}</div>
    <p class="q-feedback" id="qFeedback"></p>`;
  $$('.q-opt', box).forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.k))));
  layoutAfterOpen();
}

async function answer(choice) {
  const { api, esc, sound } = ctx, q = cur().quiz, run = cur(), item = q.pool[q.i];
  const btns = $$('#sealq .q-opt');
  btns.forEach((b) => { b.disabled = true; });
  let ok, right;
  if (item.draft) { right = item.answer; ok = choice === right; }
  else {
    const r = await api('/api/quiz/check', { id: item.id, choice });
    if (cur() !== run) return;
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
  const { state, api, showEarned, esc, sound } = ctx, q = cur().quiz, run = cur();
  const share = q.right / q.pool.length;
  const seals = share === 1 ? 3 : share >= 0.8 ? 2 : share >= 0.6 ? 1 : 0;
  const mark = SEAL_MARK[cur().id] || 'V';
  const words = ['The wax did not set this time. Read the cards again and try once more.',
    'One seal pressed. A good start.', 'Two seals pressed. Nearly perfect.', 'All three seals pressed. A perfect letter!'][seals];
  $('#sealq').innerHTML = `<div class="seal-result">
      <div class="wax-row">${[0, 1, 2].map((k) => `<div class="wax ${k < seals ? 'press' : 'off'}" style="--d:${k * 0.25}s">${mark}</div>`).join('')}</div>
      <h4>${q.right} of ${q.pool.length} right</h4><p>${esc(words)}</p>
      <button class="btn" id="qAgain">Try again</button></div>`;
  if (seals) sound.thunk();
  $('#qAgain').addEventListener('click', () => startQuiz(cur().c));
  layoutAfterOpen();
  const real = q.picks.filter((p) => !p.draft);
  if (state.user && real.length) {
    const r = await api('/api/progress/quiz', { city: run.id, answers: real.map(({ id, choice }) => ({ id, choice })) });
    if (cur() === run) showEarned(r);
  } else if (!state.user) {
    $('#cpTitle').textContent = 'Sign your passport';
    $('#cpText').textContent = `${seals ? 'Your seal is pressed.' : 'Your letter is read.'} Sign your passport and Virasat keeps your ${esc(cur().c.name)} stamp and score, on any device.`;
    $('#checkpoint').hidden = false;
  }
}

