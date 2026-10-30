// Classes, on the page: joining with a code and a nickname, "My classes" in the passport, and the
// teacher's results table with homework. The rules live on the server (server/api/classes.js).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let ctx; // from app.js: state, CITIES, api, esc, toast, openModal, closeModal, onJoined, openJourney

export function initClasses(shared) {
  ctx = shared;
  $('#classForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget, err = $('#classError');
    const r = await ctx.api('/api/classes/join', { code: f.code.value, nickname: f.nickname.value });
    if (!r.ok) { err.textContent = r.data.error; return; }
    err.textContent = '';
    ctx.closeModal($('#classModal'));
    ctx.onJoined(r.data);
  });
  // a link like virasat-psi.vercel.app/?class=K7Q2MX opens the join form with the code filled in
  const code = new URLSearchParams(location.search).get('class');
  if (code) openJoin(code);
}

export function openJoin(code = '') {
  const f = $('#classForm');
  f.code.value = code;
  $('.nick', f).hidden = !!ctx.state.user;
  $('#classError').textContent = '';
  ctx.openModal($('#classModal'));
}

// The "My classes" part of the passport.
export async function classesSection(box) {
  const { api, esc, CITIES } = ctx;
  const r = await api('/api/classes');
  const d = r.ok ? r.data : { teaching: [], member: [] };
  const due = (h) => (h.dueOn ? ` · by ${new Date(h.dueOn + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : '');
  box.innerHTML = `
    <h3 class="pp-sub">My classes</h3>
    ${d.member.map((c) => `<div class="cl-row"><div><b>${esc(c.name)}</b><small>with ${esc(c.teacher)} · you are "${esc(c.nickname)}"</small>
      ${c.homework.length ? `<small class="hw">Homework: ${c.homework.map((h) => `${esc(CITIES[h.city]?.name || h.city)}${due(h)}`).join(', ')}</small>` : ''}</div></div>`).join('')}
    ${d.teaching.map((c) => `<div class="cl-row"><div><b>${esc(c.name)}</b><small>You teach this · code <code>${esc(c.code)}</code> · ${c.students} student${c.students === 1 ? '' : 's'}</small></div>
      <button class="btn small" data-results="${esc(c.code)}">See results</button></div>`).join('')}
    ${!d.member.length && !d.teaching.length ? '<p class="cl-empty">Using Virasat with a class? Start one and share its code, or join with your teacher\'s code.</p>' : ''}
    <div class="cl-actions">
      <button class="btn small" id="clJoin">Join a class</button>
      <form id="clNew" class="cl-new"><input name="name" aria-label="Class name" placeholder="Class name, e.g. 8B Social Science" required><button class="btn small">Start a class</button></form>
    </div>`;
  $('#clJoin', box).onclick = () => openJoin();
  $$('[data-results]', box).forEach((b) => b.addEventListener('click', () => showResults(b.dataset.results)));
  $('#clNew', box).addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await api('/api/classes', { name: e.currentTarget.name.value });
    if (!res.ok) { ctx.toast(res.data.error); return; }
    showResults(res.data.class.code);
  });
}

// The teacher's view: students down the side, cities across, with homework at the top.
async function showResults(code) {
  const { api, esc, CITIES } = ctx, body = $('#journeyBody');
  body.innerHTML = '<p>Loading the class…</p>';
  const r = await api(`/api/classes/${encodeURIComponent(code)}/results`);
  if (!r.ok) { body.innerHTML = `<p>${esc(r.data.error)}</p>`; return; }
  const d = r.data, link = `${location.origin}/?class=${d.class.code}`;
  const cell = (x) => (x.opened ? `<span class="cl-cell">${x.stamp ? `<i class="st b${x.stamp}" title="Stamp, level ${x.stamp}"></i>` : ''}${x.best ? `${x.best.score}/${x.best.total}` : 'opened'}${x.read ? ` · ${x.read} read` : ''}</span>` : '<span class="cl-cell none">not yet</span>');
  body.innerHTML = `
    <div class="cl-head"><h3>${esc(d.class.name)}</h3>
      <p>Students join at <code>${esc(link)}</code>, or with the code <b class="cl-code">${esc(d.class.code)}</b> under "Join a class".</p></div>
    <form class="cl-hw" id="clHw"><label>Set homework <select name="city">${d.cities.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
      <label>by <input type="date" name="dueOn"></label><button class="btn small">Set</button></form>
    ${d.homework.length ? `<p class="cl-hwlist">Homework: ${d.homework.map((h) => `${esc(CITIES[h.city]?.name || h.city)}${h.dueOn ? ` by ${esc(h.dueOn)}` : ''}`).join(' · ')}</p>` : ''}
    <div class="cl-table-wrap"><table class="cl-table">
      <thead><tr><th>Student</th>${d.cities.map((c) => `<th>${esc(c.name)}</th>`).join('')}</tr></thead>
      <tbody>${d.students.map((s) => `<tr><td>${esc(s.name)}</td>${d.cities.map((c) => `<td>${cell(s.cities[c.id])}</td>`).join('')}</tr>`).join('')
        || `<tr><td colspan="${d.cities.length + 1}">No students yet. Share the code with your class.</td></tr>`}</tbody>
    </table></div>
    <p class="cl-key">Score = best Seal the letter round · "read" = parts of the letter read · the dot is their passport stamp (darker = remembered longer).</p>
    <div class="pp-actions"><button class="btn" id="clBack">Back to my passport</button></div>`;
  $('#clBack').onclick = ctx.openJourney;
  $('#clHw').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const res = await api(`/api/classes/${encodeURIComponent(code)}/assign`, { city: f.city.value, dueOn: f.dueOn.value });
    if (!res.ok) { ctx.toast(res.data.error); return; }
    ctx.toast('Homework set.');
    showResults(code);
  });
}
