// The passport: points, the stamps with their ink, classes, and the memory letter that re-inks a fading stamp.
// The rules for fading live on the server (server/api/passport.js); this draws them.
import { $, $$, api, esc } from './lib.js';
import { stampHTML } from './stamps.js';
import { classesSection } from './classes.js';

// what app.js shares when the page starts
let state, CITIES, openModal, closeModal, openAuth, logout, sound, showEarned, say;
export function initPassport(shared) {
  ({ state, CITIES, openModal, closeModal, openAuth, logout, sound, showEarned, say } = shared);
}

export async function openJourney() {
  if (!state.user) {
    state.afterAuth = () => openJourney();
    return openAuth(undefined, 'Log in to see your Virasat passport.');
  }
  const body = $('#journeyBody');
  body.innerHTML = '<p>Loading your passport…</p>';
  openModal($('#journeyModal'));
  const [r, pass] = await Promise.all([api('/api/progress'), api('/api/passport')]);
  if (!r.ok) {
    body.innerHTML = `<p>${esc(r.data.error || 'Your passport could not load.')}</p><button class="btn" id="ppRetry">Try again</button>`;
    $('#ppRetry').onclick = openJourney;
    return;
  }
  const visits = Object.fromEntries((r.data.visits || []).map((v) => [v.city, v]));
  const quizzes = Object.fromEntries((r.data.quizzes || []).map((q) => [q.city, q]));
  const read = (cityId) => (r.data.covered || []).filter((x) => x.city === cityId).length;
  const stamps = Object.fromEntries((pass.ok ? pass.data.stamps : []).map((s) => [s.city, s]));
  const u = state.user;
  const joined = new Date((u.createdAt || '').replace(' ', 'T') + 'Z');
  const via = { email: 'Email', phone: 'Phone', google: 'Google' };
  const masked = u.phone ? u.phone.slice(0, 3) + ' ••••• ' + u.phone.slice(-3) : '';
  body.innerHTML = `
    <div class="pp-who">
      <div class="av">${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc(u.name[0]?.toUpperCase() || 'V')}</div>
      <div><b>${esc(u.name)}</b><small>${esc(u.email || masked)}<br>Signed in with ${(u.via || []).map((v) => via[v]).join(', ') || '—'}${isNaN(joined) ? '' : ` · joined ${joined.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}</small></div>
    </div>
    <div class="pp-points"><b>${Number(r.data.points || 0)}</b> points
      <small>10 for each new city · 5 for each part of a letter you read · 10 for each correct answer on your best Seal the letter</small></div>
    <div class="pp-stamps">${Object.values(CITIES).map((c) => {
      const v = visits[c.id], q = quizzes[c.id], s = stamps[c.id];
      return `<div class="pp-slot ${s ? (s.due ? 'fading' : '') : 'empty'}">
        <div class="pp-stamp" style="--ink:${s ? s.ink : 1}">${stampHTML(c, `${esc(c.name)} stamp`)}${s?.box >= 4 ? '<span class="kept">Kept</span>' : ''}</div>
        <b>${esc(c.name)}</b>
        <small class="ink-line">${inkLine(s)}</small>
        ${s?.due ? `<button class="btn primary reink" data-reink="${c.id}">Re-ink it</button>` : ''}
        <small>${v ? `Opened ${v.count} time${v.count > 1 ? 's' : ''}` : 'Not visited yet'}<br>Read ${read(c.id)} of ${c.sections.length} parts<br>${q ? `Best seal: ${q.best} of ${q.total} right` : 'Letter not sealed yet'}</small>
      </div>`;
    }).join('')}</div>
    <div class="pp-classes" id="ppClasses"></div>
    <p class="pp-how">Stamps fade so you remember. Each time one fades, answer Gaju's three questions to re-ink it: after 2 days, then 7, then 21. After that it is yours for good.</p>
    <div class="pp-actions">
      ${Object.values(CITIES).map((c) => `<button class="btn primary" data-go="${c.id}">Visit ${esc(c.name)}</button>`).join('')}
      ${['editor', 'admin'].includes(u.role) ? '<a class="btn" href="/admin">Editor page</a>' : ''}
      <button class="btn" id="logoutBtn">Log out</button>
    </div>
    <p class="pp-privacy"><a href="/privacy" target="_blank" rel="noopener">Privacy</a> · <button type="button" class="link-btn" id="deleteAccount">Delete my account</button></p>`;
  $$('[data-go]', body).forEach((b) => b.addEventListener('click', () => closeModal($('#journeyModal')), { capture: true }));
  $('#logoutBtn').onclick = logout;
  $('#deleteAccount').onclick = async () => {
    const typed = prompt('This deletes your account, stamps, scores, points and class places for good.\n\nType DELETE to confirm.');
    if (typed === null) return;
    const res = await api('/api/auth/delete-account', { confirm: typed.trim().toUpperCase() });
    if (!res.ok) { alert(res.data.error || 'Your account could not be deleted. Please try again.'); return; }
    location.href = '/';
  };
  $$('[data-reink]', body).forEach((b) => b.addEventListener('click', () => openRecall(b.dataset.reink)));
  classesSection($('#ppClasses'));
}

const BOX_WORDS = { 1: 'Fresh ink', 2: 'Remembered once', 3: 'Remembered twice' };
function inkLine(s) {
  if (!s) return 'Seal the letter to earn this stamp';
  if (s.box >= 4) return 'Kept for good';
  if (s.due) return s.ink > 0.6 ? 'Starting to fade' : 'Fading';
  const days = Math.max(1, Math.ceil((new Date(s.dueAt) - Date.now()) / 86400000));
  return `${BOX_WORDS[s.box]} · fades in ${days} day${days > 1 ? 's' : ''}`;
}

// ---------------------------------------------------------------- the memory letter
// When a stamp fades, Gaju sends three questions about that city. Two or more right re-inks it.
export async function openRecall(cityId) {
  const c = CITIES[cityId], body = $('#journeyBody');
  body.innerHTML = '<p>Gaju is writing your letter…</p>';
  if ($('#journeyModal').hidden) openModal($('#journeyModal'));
  const r = await api(`/api/recall/${cityId}`);
  if (!r.ok) {
    body.innerHTML = `<p>${esc(r.data.error)}</p><button class="btn" id="recallBack">Back to my passport</button>`;
    $('#recallBack').onclick = openJourney;
    return;
  }
  const qs = r.data.questions, picks = [];
  const show = (i) => {
    const q = qs[i];
    body.innerHTML = `
      <div class="recall">
        <div class="recall-head"><div class="pp-stamp small" style="--ink:.5">${stampHTML(c)}</div>
          <div><b>A memory letter from ${esc(c.name)}</b><small>Question ${i + 1} of ${qs.length}. Two right re-inks your stamp.</small></div></div>
        <p class="q-text">${esc(q.q)}</p>
        <div class="q-opts">${q.options.map((o, k) => `<button class="q-opt" data-k="${k}">${esc(o)}</button>`).join('')}</div>
      </div>`;
    $$('.q-opt', body).forEach((b) => b.addEventListener('click', () => {
      picks.push({ id: q.id, choice: Number(b.dataset.k) });
      if (i + 1 < qs.length) show(i + 1); else finish();
    }));
  };
  // answers are marked only at the end, so the letter tests memory rather than guessing
  const finish = async () => {
    body.innerHTML = '<p>Pressing the stamp…</p>';
    const res = await api(`/api/recall/${cityId}`, { answers: picks });
    if (!res.ok) { body.innerHTML = `<p>${esc(res.data.error)}</p>`; return; }
    const d = res.data;
    body.innerHTML = `
      <div class="recall done">
        <div class="pp-stamp big ${d.passed ? 'reinked' : ''}" style="--ink:${d.passed ? 1 : 0.5}">${stampHTML(c)}</div>
        <b>${d.right} of ${d.asked} right</b>
        <p>${d.passed ? (d.box >= 4 ? `${esc(c.name)} is yours for good.` : `Re-inked. It will start to fade again in ${{ 2: 7, 3: 21 }[d.box]} days.`)
          : 'Not this time. Read the letter again and try tomorrow.'}</p>
        <div class="pp-actions"><button class="btn" id="recallBack">Back to my passport</button>${d.passed ? '' : `<button class="btn primary" data-go="${cityId}">Read ${esc(c.name)} again</button>`}</div>
      </div>`;
    if (d.passed) { sound.thunk(); showEarned(res); }
    $('#recallBack').onclick = openJourney;
    $$('[data-go]', body).forEach((b) => b.addEventListener('click', () => closeModal($('#journeyModal')), { capture: true }));
  };
  show(0);
}

// On arrival, Gaju mentions a stamp that is fading; tapping him then opens its memory letter.
let fadingCity = null;
// Gaju's tap: if a stamp is fading, open its memory letter and say so.
export function openFadingRecall() {
  if (!fadingCity) return false;
  const id = fadingCity; fadingCity = null; openRecall(id);
  return true;
}
export async function checkFading() {
  if (!state.user) return;
  const r = await api('/api/passport');
  const due = (r.ok ? r.data.stamps : []).find((s) => s.due && CITIES[s.city]);
  fadingCity = due?.city || null;
  if (fadingCity) say(`Your ${CITIES[fadingCity].name} stamp is fading! Tap me to re-ink it.`, 0);
}

