// The editor page. Everything here goes through /api/admin/...; the server checks every rule,
// so this page only has to show things clearly and send what people type.

import { MOTIF_NAMES, motifSVG } from './motifs.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (t) => (t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const state = { me: null, cities: [], city: null, data: null, tab: 'facts', filter: 'needs_check', placeSearch: '' };

async function api(path, body, method = body ? 'POST' : 'GET') {
  try {
    const res = await fetch(path, {
      method, credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach the server. Check your connection.' } };
  }
}

let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------------------------------------------------------------- form dialog
// fields: [{ name, label, type: 'text'|'textarea'|'select'|'url', value, options, hint }]
function openForm(title, fields, onSave) {
  const dlg = $('#dlg');
  $('#dlgTitle').textContent = title;
  $('#dlgError').textContent = '';
  $('#dlgBody').innerHTML = fields.map((f) => {
    const id = 'f_' + f.name;
    const hint = f.hint ? ` <small>${esc(f.hint)}</small>` : '';
    let input;
    if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}">${esc(f.value)}</textarea>`;
    else if (f.type === 'select') input = `<select id="${id}" name="${f.name}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else input = `<input id="${id}" name="${f.name}" type="${f.type === 'url' ? 'url' : 'text'}" value="${esc(f.value)}" ${f.type === 'url' ? 'placeholder="https://…"' : ''}>`;
    return `<label for="${id}">${esc(f.label)}${hint}</label>${input}`;
  }).join('');
  $('#dlgCancel').onclick = () => dlg.close();
  $('#dlgForm').onsubmit = async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(fields.map((f) => [f.name, $(`#f_${f.name}`).value]));
    $('#dlgSave').disabled = true;
    const error = await onSave(values);
    $('#dlgSave').disabled = false;
    if (error) $('#dlgError').textContent = error;
    else dlg.close();
  };
  dlg.showModal();
}

// ---------------------------------------------------------------- start
async function boot() {
  const me = await api('/api/me');
  state.me = me.data.user || null;
  renderWho();
  if (!state.me) return renderLogin();
  if (!['editor', 'admin'].includes(state.me.role)) return renderNotEditor();
  const c = await api('/api/admin/cities');
  state.cities = c.data.cities || [];
  state.city = state.city || state.cities[0]?.id;
  await loadCity();
  render();
}

function renderWho() {
  const u = state.me;
  $('#who').innerHTML = u
    ? `<span>${esc(u.name)}</span><span class="role">${esc(u.role)}</span><a href="/">Website</a><button class="btn small" id="logout">Log out</button>`
    : '<a href="/">Back to the website</a>';
  if (u) $('#logout').onclick = async () => { await api('/api/auth/logout', {}); location.reload(); };
}

function renderLogin() {
  $('#app').innerHTML = `
    <div class="panel" style="max-width:420px">
      <h1>Editor log in</h1>
      <p class="muted">Use the email and password of your Virasat account. If you signed up with a phone number,
        log in on <a href="/">the website</a> first and then come back here.</p>
      <form id="login">
        <label for="em">Email</label><input id="em" type="email" autocomplete="email" required>
        <label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required>
        <p class="form-error" id="loginErr"></p>
        <button class="btn primary">Log in</button>
      </form>
    </div>`;
  $('#login').onsubmit = async (e) => {
    e.preventDefault();
    const r = await api('/api/auth/login', { email: $('#em').value, password: $('#pw').value });
    if (!r.ok) { $('#loginErr').textContent = r.data.error; return; }
    boot();
  };
}

function renderNotEditor() {
  $('#app').innerHTML = `
    <div class="panel" style="max-width:560px">
      <h1>You are not an editor yet</h1>
      <p>Ask your team's admin to make your account (<b>${esc(state.me.email || state.me.phone)}</b>) an editor on the Team tab.</p>
      <h3>Setting up the site for the first time?</h3>
      <p class="muted">The first admin enters the setup code. It only works while the site has no admin.</p>
      <form id="claim" class="row">
        <input id="code" placeholder="Setup code" style="max-width:260px" required>
        <button class="btn primary">Become admin</button>
      </form>
      <p class="form-error" id="claimErr"></p>
    </div>`;
  $('#claim').onsubmit = async (e) => {
    e.preventDefault();
    const r = await api('/api/admin/claim', { code: $('#code').value.trim() });
    if (!r.ok) { $('#claimErr').textContent = r.data.error; return; }
    toast('You are now the admin.');
    boot();
  };
}

async function loadCity() {
  const r = await api(`/api/admin/cities/${encodeURIComponent(state.city)}`);
  state.data = r.ok ? r.data : null;
}

async function refresh() {
  const c = await api('/api/admin/cities');
  state.cities = c.data.cities || state.cities;
  await loadCity();
  render();
}

// ---------------------------------------------------------------- layout
function render() {
  const isAdmin = state.me.role === 'admin';
  const tabs = [['facts', 'Facts'], ['quiz', 'Quiz'], ['timeline', 'Timeline'], ['places', 'Places'], ['letter', 'City letter'], ['greetings', 'Greetings'], ...(isAdmin ? [['team', 'Team']] : []), ['log', 'History'], ['help', 'How this works']];
  $('#app').innerHTML = `
    <div class="cities">${state.cities.map((c) => `
      <button class="btn city-btn" data-city="${esc(c.id)}" aria-pressed="${c.id === state.city}">
        ${esc(c.name)}${c.published ? '' : ' (hidden)'}
        <small>${c.facts_to_check + c.quiz_to_check + c.timeline_to_check} to check · ${c.facts_verified + c.quiz_verified + c.timeline_verified} live</small>
      </button>`).join('')}</div>
    <div class="tabs" role="tablist">${tabs.map(([id, label]) =>
      `<button class="tab" role="tab" data-tab="${id}" aria-selected="${state.tab === id}">${label}</button>`).join('')}</div>
    <section id="view"></section>`;
  $$('[data-city]').forEach((b) => b.onclick = async () => { state.city = b.dataset.city; await loadCity(); render(); });
  $$('[data-tab]').forEach((b) => b.onclick = () => { state.tab = b.dataset.tab; render(); });
  ({ facts: renderFacts, quiz: renderQuiz, timeline: renderTimeline, places: renderPlaces, letter: renderLetter, greetings: renderGreetings, team: renderTeam, log: renderLog, help: renderHelp })[state.tab]();
}

const people = (x) => [
  x.created_by_name ? `written by ${esc(x.created_by_name)}` : 'imported from the old site',
  x.updated_by_name && x.updated_by !== x.created_by ? `last changed by ${esc(x.updated_by_name)}` : '',
  x.status === 'verified' ? `verified by ${esc(x.verified_by_name || '?')} on ${when(x.verified_at)}` : '',
].filter(Boolean).join(' · ');

const badge = (x) => (x.status === 'verified' ? '<span class="badge ok">Live</span>' : '<span class="badge">Needs check</span>');

// Why this person cannot verify this item, or '' if they can. The server checks the same rule.
const cannotVerify = (x) => (!x.source_url ? 'Add a source link first.' : (x.authors || []).includes(state.me.id) ? 'You wrote or changed these words, so someone else must verify them.' : '');

function filters(items) {
  const counts = { needs_check: items.filter((x) => x.status === 'needs_check').length, verified: items.filter((x) => x.status === 'verified').length };
  return `<div class="filters">${[['needs_check', `Needs check (${counts.needs_check})`], ['verified', `Live (${counts.verified})`], ['all', `All (${items.length})`]]
    .map(([v, l]) => `<button class="chip" data-filter="${v}" aria-pressed="${state.filter === v}">${l}</button>`).join('')}</div>`;
}
const shown = (x) => state.filter === 'all' || x.status === state.filter;
const wireFilters = () => $$('[data-filter]').forEach((b) => b.onclick = () => { state.filter = b.dataset.filter; render(); });

function itemButtons(kind, x) {
  const why = cannotVerify(x);
  return `<div class="row">
    <button class="btn small" data-edit="${x.id}">Edit</button>
    ${x.status === 'verified'
      ? `<button class="btn small" data-unverify="${x.id}">Take off the website</button>`
      : `<button class="btn small ok" data-verify="${x.id}" ${why ? `disabled title="${esc(why)}"` : ''}>I checked the source · Verify</button>${why ? `<span class="muted" style="font-size:13px">${esc(why)}</span>` : ''}`}
    <span class="spacer"></span>
    <button class="btn small danger" data-del="${x.id}">Delete</button>
  </div>`;
}

function wireItems(kind, list, edit) {
  const find = (id) => list.find((x) => x.id === Number(id));
  $$('[data-edit]').forEach((b) => b.onclick = () => edit(find(b.dataset.edit)));
  // send the version on screen, so a change made meanwhile is never verified unseen
  $$('[data-verify]').forEach((b) => b.onclick = () => act(`/api/admin/${kind}/${b.dataset.verify}/verify`, { updatedAt: find(b.dataset.verify).updated_at }, 'POST', 'Verified. It is now on the website.'));
  $$('[data-unverify]').forEach((b) => b.onclick = () => act(`/api/admin/${kind}/${b.dataset.unverify}/unverify`, {}, 'POST', 'Taken off the website. It needs a check again.'));
  $$('[data-del]').forEach((b) => b.onclick = () => {
    if (confirm('Delete this for good? It will stay in the History tab.')) act(`/api/admin/${kind}/${b.dataset.del}`, null, 'DELETE', 'Deleted.');
  });
}

async function act(path, body, method, okMsg) {
  const r = await api(path, body, method);
  if (!r.ok) return toast(r.data.error || 'That did not work.', true);
  toast(r.data.backToCheck ? 'Saved. Because the words changed, it needs to be checked again.' : okMsg);
  refresh();
}

// ---------------------------------------------------------------- facts
function renderFacts() {
  const { sections } = state.data;
  const all = sections.flatMap((s) => s.facts);
  $('#view').innerHTML = `
    <div class="row"><p class="muted" style="margin:0">Only <b>Live</b> facts appear on the website. A teammate who did not make the latest change must check the source and verify.</p>
      <span class="spacer"></span><button class="btn primary" id="addFact">+ Add a fact</button></div>
    ${filters(all)}
    ${sections.map((s) => {
      const list = s.facts.filter(shown);
      return `<h3>${esc(s.icon)} ${esc(s.label)} <span class="muted" style="font-weight:400">(${s.facts.length})</span></h3>
        ${list.length ? list.map((f) => `
          <article class="item ${f.status === 'verified' ? 'verified' : ''}">
            <h4>${esc(f.title)} ${badge(f)}</h4>
            <p>${esc(f.body)}</p>
          ${f.image ? `<span class="thumbs"><a href="${esc(f.image.page || f.image.src)}" target="_blank" rel="noopener"><img src="${esc(f.image.src)}" alt="${esc(f.image.caption)}" loading="lazy"></a></span><small class="muted">${esc(f.image.credit)}</small>` : ''}
            ${f.source_url ? `<a class="src" href="${esc(f.source_url)}" target="_blank" rel="noopener">${esc(f.source_url)}</a>` : '<span class="badge">No source yet</span>'}
            <div class="meta">${people(f)}</div>
            ${itemButtons('facts', f)}
          </article>`).join('') : '<p class="muted">Nothing here.</p>'}`;
    }).join('')}`;
  wireFilters();
  $('#addFact').onclick = () => editFact(null);
  wireItems('facts', all, editFact);
}

function editFact(f) {
  const sections = state.data.sections;
  openForm(f ? 'Edit fact' : 'Add a fact', [
    { name: 'sectionId', label: 'Section', type: 'select', value: f?.section_id ?? sections[0].id, options: sections.map((s) => [s.id, `${s.icon} ${s.label}`]) },
    { name: 'title', label: 'Title', type: 'text', value: f?.title ?? '' },
    { name: 'text', label: 'Text', type: 'textarea', value: f?.body ?? '', hint: 'one or two short sentences' },
    { name: 'sourceUrl', label: 'Source link', type: 'url', value: f?.source_url ?? '', hint: 'where a teammate can check this' },
    { name: 'imageSrc', label: 'Photo link (optional)', type: 'url', value: f?.image?.src ?? '',
      hint: 'a freely licensed photo, e.g. from Wikimedia Commons (CC BY, CC BY-SA, CC0 or public domain)' },
    { name: 'imagePage', label: "Photo's page", type: 'url', value: f?.image?.page ?? '', hint: 'the page that shows its licence' },
    { name: 'imageCredit', label: 'Photo credit', type: 'text', value: f?.image?.credit ?? '', hint: 'author and licence, e.g. "Henrik Bennetsen, CC BY-SA 2.0, via Wikimedia Commons"' },
    { name: 'imageCaption', label: 'Photo caption', type: 'text', value: f?.image?.caption ?? '', hint: 'what the photo shows' },
  ], async (v) => {
    const r = f ? await api(`/api/admin/facts/${f.id}`, v, 'PUT') : await api('/api/admin/facts', v);
    if (!r.ok) return r.data.error;
    toast(r.data.backToCheck ? 'Saved. Because the words changed, it needs to be checked again.' : f ? 'Saved.' : 'Added. A teammate now needs to verify it.');
    refresh();
  });
}

// ---------------------------------------------------------------- quiz
function renderQuiz() {
  const { quiz } = state.data;
  $('#view').innerHTML = `
    <div class="row"><p class="muted" style="margin:0">Quiz questions follow the same check-before-live rule. The right answer is shown in green.</p>
      <span class="spacer"></span><button class="btn primary" id="addQ">+ Add a question</button></div>
    ${filters(quiz)}
    ${quiz.filter(shown).map((q) => `
      <article class="item ${q.status === 'verified' ? 'verified' : ''}">
        <h4>${esc(q.question)} ${badge(q)}</h4>
        <ol>${q.options.map((o, i) => `<li class="${i === q.answer_index ? 'right' : ''}">${esc(o)}${i === q.answer_index ? ' ✓' : ''}</li>`).join('')}</ol>
        ${q.source_url ? `<a class="src" href="${esc(q.source_url)}" target="_blank" rel="noopener">${esc(q.source_url)}</a>` : '<span class="badge">No source yet</span>'}
        <div class="meta">${people(q)}</div>
        ${itemButtons('quiz', q)}
      </article>`).join('') || '<p class="muted">Nothing here.</p>'}`;
  wireFilters();
  $('#addQ').onclick = () => editQuestion(null);
  wireItems('quiz', quiz, editQuestion);
}

function editQuestion(q) {
  const opts = q?.options ?? ['', '', '', ''];
  openForm(q ? 'Edit question' : 'Add a question', [
    { name: 'question', label: 'Question', type: 'text', value: q?.question ?? '' },
    { name: 'options', label: 'Options', type: 'textarea', value: opts.join('\n'), hint: 'one per line, 2 to 6 options' },
    { name: 'answer', label: 'Which line is the right answer?', type: 'select', value: (q?.answer_index ?? 0) + 1, options: [1, 2, 3, 4, 5, 6].map((n) => [n, `Line ${n}`]) },
    { name: 'sourceUrl', label: 'Source link', type: 'url', value: q?.source_url ?? '' },
  ], async (v) => {
    const body = { cityId: state.city, question: v.question, options: v.options.split('\n').map((s) => s.trim()).filter(Boolean), answerIndex: Number(v.answer) - 1, sourceUrl: v.sourceUrl };
    const r = q ? await api(`/api/admin/quiz/${q.id}`, body, 'PUT') : await api('/api/admin/quiz', body);
    if (!r.ok) return r.data.error;
    toast(r.data.backToCheck ? 'Saved. Because it changed, it needs to be checked again.' : q ? 'Saved.' : 'Added. A teammate now needs to verify it.');
    refresh();
  });
}

// ---------------------------------------------------------------- timeline
function renderTimeline() {
  const { timeline } = state.data;
  $('#view').innerHTML = `
    <div class="row"><p class="muted" style="margin:0">The major events shown along the thread under the letter, in the order of their <b>place</b> number. Keep each one to a short paragraph.</p>
      <span class="spacer"></span><button class="btn primary" id="addEv">+ Add an event</button></div>
    ${filters(timeline)}
    ${timeline.filter(shown).map((e) => `
      <article class="item ${e.status === 'verified' ? 'verified' : ''}">
        <h4><span class="year">${esc(e.year_label)}</span> ${esc(e.title)} ${badge(e)} <span class="muted" style="font-weight:400;font-size:13px">place ${e.sort_order}</span></h4>
        <p>${esc(e.body)}</p>
        ${e.memory ? `<p class="memory"><b>Remembered as:</b> ${esc(e.memory)}${e.argued ? `<br><b>Why argued:</b> ${esc(e.argued)}` : ''}</p>` : ''}
        ${e.motif ? `<span class="motif">${motifSVG(e.motif)}</span>` : ''}
        ${e.images.length ? `<div class="thumbs">${e.images.map((im) => `<a href="${esc(im.src)}" target="_blank" rel="noopener"><img src="${esc(im.src)}" alt="${esc(im.caption)}" loading="lazy"></a>`).join('')}</div>` : '<span class="badge">No photos yet</span> '}
        ${e.source_url ? `<a class="src" href="${esc(e.source_url)}" target="_blank" rel="noopener">${esc(e.source_url)}</a>` : '<span class="badge">No source yet</span>'}
        <div class="meta">${people(e)}</div>
        ${itemButtons('timeline', e)}
      </article>`).join('') || '<p class="muted">Nothing here.</p>'}`;
  wireFilters();
  $('#addEv').onclick = () => editEvent(null);
  wireItems('timeline', timeline, editEvent);
}

function editEvent(e) {
  const last = Math.max(0, ...state.data.timeline.map((x) => x.sort_order));
  openForm(e ? 'Edit event' : 'Add an event', [
    { name: 'year', label: 'Year', type: 'text', value: e?.year_label ?? '', hint: 'as it should appear, e.g. 1559, 1620s or c. 1360' },
    { name: 'title', label: 'Title', type: 'text', value: e?.title ?? '' },
    { name: 'text', label: 'Short paragraph', type: 'textarea', value: e?.body ?? '', hint: 'two or three sentences' },
    { name: 'images', label: 'Photos', type: 'textarea', value: (e?.images ?? []).map((im) => `${im.src} | ${im.caption}`).join('\n'),
      hint: 'up to 4, one per line: https://link-to-photo | caption. Use photos you may share (e.g. Wikimedia Commons) and put the credit in the caption.' },
    { name: 'motif', label: 'Drawing', type: 'select', value: e?.motif ?? '', options: [['', 'None (show the city stamp)'], ...MOTIF_NAMES.map((m) => [m, m])],
      hint: 'shown when the event has no photo' },
    { name: 'order', label: 'Place on the timeline', type: 'text', value: e?.sort_order ?? last + 1, hint: 'events are shown from the smallest number to the largest' },
    { name: 'sourceUrl', label: 'Source link', type: 'url', value: e?.source_url ?? '' },
    { name: 'memory', label: 'How it is remembered (optional)', type: 'textarea', value: e?.memory ?? '',
      hint: 'only when people remember this event differently from what the sources show. The paragraph above is the record; this is the memory. The page shows them side by side.' },
    { name: 'memorySourceUrl', label: 'Source for how it is remembered', type: 'url', value: e?.memory_source_url ?? '' },
    { name: 'argued', label: 'Why people disagree (one line)', type: 'text', value: e?.argued ?? '' },
  ], async (v) => {
    const images = v.images.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map((p) => ({ src: p[0], caption: p.slice(1).join(' | ') }));
    const body = { cityId: state.city, year: v.year, title: v.title, text: v.text, images, motif: v.motif, order: Number(v.order) || 0, sourceUrl: v.sourceUrl,
      memory: v.memory, memorySourceUrl: v.memorySourceUrl, argued: v.argued };
    const r = e ? await api(`/api/admin/timeline/${e.id}`, body, 'PUT') : await api('/api/admin/timeline', body);
    if (!r.ok) return r.data.error;
    toast(r.data.backToCheck ? 'Saved. Because the words changed, it needs to be checked again.' : e ? 'Saved.' : 'Added. A teammate now needs to verify it.');
    refresh();
  });
}

// ---------------------------------------------------------------- greetings (whole site)
async function renderGreetings() {
  $('#view').innerHTML = '<p class="muted">Loading…</p>';
  const r = await api('/api/admin/greetings');
  const list = r.data.greetings || [];
  $('#view').innerHTML = `
    <div class="row"><p class="muted" style="margin:0">The greetings that scroll in the yellow bar at the top of the website. They are the same for every city.</p>
      <span class="spacer"></span><button class="btn primary" id="addGr">+ Add a greeting</button></div>
    ${filters(list)}
    ${list.filter(shown).map((g) => `
      <article class="item ${g.status === 'verified' ? 'verified' : ''}">
        <h4>${esc(g.word)} <span lang="">${esc(g.native)}</span> <span class="muted" style="font-weight:400">· ${esc(g.language)}</span> ${badge(g)}</h4>
        ${g.source_url ? `<a class="src" href="${esc(g.source_url)}" target="_blank" rel="noopener">${esc(g.source_url)}</a>` : '<span class="badge">No source yet</span>'}
        <div class="meta">${people(g)}</div>
        ${itemButtons('greetings', g)}
      </article>`).join('') || '<p class="muted">Nothing here.</p>'}`;
  wireFilters();
  $('#addGr').onclick = () => editGreeting(null);
  wireItems('greetings', list, editGreeting);
}

function editGreeting(g) {
  openForm(g ? 'Edit greeting' : 'Add a greeting', [
    { name: 'word', label: 'Greeting in English letters', type: 'text', value: g?.word ?? '', hint: 'e.g. Vanakkam' },
    { name: 'native', label: 'In its own script', type: 'text', value: g?.native ?? '', hint: 'e.g. வணக்கம்' },
    { name: 'language', label: 'Language', type: 'text', value: g?.language ?? '' },
    { name: 'sourceUrl', label: 'Source link', type: 'url', value: g?.source_url ?? '' },
  ], async (v) => {
    const r = g ? await api(`/api/admin/greetings/${g.id}`, v, 'PUT') : await api('/api/admin/greetings', v);
    if (!r.ok) return r.data.error;
    toast(r.data.backToCheck ? 'Saved. Because it changed, it needs to be checked again.' : g ? 'Saved.' : 'Added. A teammate now needs to verify it.');
    refresh();
  });
}

// ---------------------------------------------------------------- city letter
function renderLetter() {
  // the form shows the draft when there is one, so the checker sees exactly what would go live
  const c = { ...state.data.city, ...(state.data.city.draft || {}) };
  const lines = (pairs) => pairs.map(([a, b]) => `${a} | ${b}`).join('\n');
  const isAdmin = state.me.role === 'admin';
  $('#view').innerHTML = `
    <form class="panel" id="letterForm">
      <p class="muted" style="margin-top:0">This is the opening of the letter visitors read. Saving makes a <b>draft</b>: a different teammate checks it against the sources and verifies it, and only then does it go live. Every change is recorded in History.</p>
      ${c.draft ? `<div class="draft-box"><b>A draft is waiting for a check</b>, saved ${esc(when(c.draft_at))}${c.draft_by === state.me.id ? ' by you' : ''}. The form below shows the draft.
        ${c.draft_by === state.me.id ? '<span class="muted">Someone else must verify it.</span>' : '<button type="button" class="btn small ok" id="verifyLetter">I checked the sources · Verify the draft</button>'}</div>` : ''}
      <div class="row">
        <div style="flex:1;min-width:200px"><label for="l_name">City name</label><input id="l_name" value="${esc(c.name)}"></div>
        <div style="flex:1;min-width:200px"><label for="l_native">Name in its own script</label><input id="l_native" value="${esc(c.native_name)}"></div>
      </div>
      <div class="row">
        <div style="flex:1;min-width:200px"><label for="l_state">State</label><input id="l_state" value="${esc(c.state)}"></div>
        <div style="flex:1;min-width:200px"><label for="l_nick">Nickname</label><input id="l_nick" value="${esc(c.nickname)}"></div>
      </div>
      <div class="row">
        <div style="flex:1;min-width:200px"><label for="l_greet">Greeting</label><input id="l_greet" value="${esc(c.greeting)}"></div>
        <div style="flex:1;min-width:200px"><label for="l_gnote">What the greeting means</label><input id="l_gnote" value="${esc(c.greeting_note)}"></div>
      </div>
      <label for="l_from">"From" line on the envelope</label><input id="l_from" value="${esc(c.from_line)}">
      <label for="l_letter">Letter <small>leave an empty line between paragraphs</small></label>
      <textarea id="l_letter" style="min-height:160px">${esc(c.letter.join('\n\n'))}</textarea>
      <label for="l_qf">Quick facts <small>one per line: Label | Value</small></label>
      <textarea id="l_qf">${esc(lines(c.quick_facts))}</textarea>
      <label for="l_src">Sources for the letter <small>one per line: What it supports | https://link</small></label>
      <textarea id="l_src">${esc(lines(c.sources))}</textarea>
      ${isAdmin ? `<label><input type="checkbox" id="l_pub" ${c.published ? 'checked' : ''} style="width:auto"> Show this city on the website</label>` : ''}
      <p class="form-error" id="letterErr"></p>
      <button class="btn primary">Save the letter</button>
    </form>`;
  const pairs = (s) => s.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map((p) => [p[0], p.slice(1).join(' | ')]);
  $('#letterForm').onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      name: $('#l_name').value, native: $('#l_native').value, state: $('#l_state').value, nickname: $('#l_nick').value,
      greeting: $('#l_greet').value, greetingNote: $('#l_gnote').value, from: $('#l_from').value,
      letter: $('#l_letter').value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      quickFacts: pairs($('#l_qf').value), sources: pairs($('#l_src').value),
      ...(isAdmin ? { published: $('#l_pub').checked } : {}),
    };
    const r = await api(`/api/admin/cities/${encodeURIComponent(c.id)}`, body, 'PUT');
    if (!r.ok) { $('#letterErr').textContent = r.data.error; return; }
    toast('Draft saved. A teammate now needs to check and verify it.');
    refresh();
  };
  $('#verifyLetter')?.addEventListener('click', () => act(`/api/admin/cities/${encodeURIComponent(c.id)}/verify`, {}, 'POST', 'Verified. The new letter is live.'));
}

// ---------------------------------------------------------------- team (admins)
async function renderTeam() {
  $('#view').innerHTML = '<p class="muted">Loading the team…</p>';
  const r = await api('/api/admin/users');
  if (!r.ok) { $('#view').innerHTML = `<p class="form-error">${esc(r.data.error)}</p>`; return; }
  $('#view').innerHTML = `
    <p class="muted">Teammates first sign up on the website. Then find them here and make them an <b>editor</b>.
      Editors write and verify content; admins can also change roles and hide cities.</p>
    <input id="teamSearch" placeholder="Search by name, email or phone" style="max-width:360px;margin-bottom:10px">
    <div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Email / phone</th><th>Joined</th><th>Role</th></tr></thead>
      <tbody>${r.data.users.map((u) => `
        <tr data-q="${esc(`${u.name} ${u.email || ''} ${u.phone || ''}`.toLowerCase())}">
          <td>${esc(u.name)}${u.id === state.me.id ? ' (you)' : ''}</td>
          <td>${esc(u.email || u.phone || '')}</td>
          <td>${esc((u.createdAt || '').slice(0, 10))}</td>
          <td><select data-user="${u.id}" style="width:auto">${['learner', 'editor', 'admin'].map((x) => `<option ${x === u.role ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
        </tr>`).join('')}</tbody>
    </table></div>`;
  $('#teamSearch').oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$('tbody tr').forEach((tr) => { tr.hidden = q && !tr.dataset.q.includes(q); });
  };
  $$('[data-user]').forEach((s) => s.onchange = async () => {
    const res = await api(`/api/admin/users/${s.dataset.user}/role`, { role: s.value }, 'PUT');
    if (!res.ok) { toast(res.data.error, true); renderTeam(); return; }
    toast(`${res.data.user.name} is now ${{ admin: 'an admin', editor: 'an editor', learner: 'a learner' }[res.data.user.role]}.`);
  });
}

// ---------------------------------------------------------------- history
async function renderLog() {
  $('#view').innerHTML = '<p class="muted">Loading…</p>';
  const r = await api('/api/admin/log');
  const words = { create: 'added', update: 'changed', verify: 'verified', unverify: 'took off the website', delete: 'deleted', role: 'changed the role of' };
  $('#view').innerHTML = `
    <p class="muted">The last 200 changes, newest first. The database keeps the full before-and-after of each one.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
      <tbody>${(r.data.log || []).map((l) => `
        <tr><td>${when(l.at)}</td><td>${esc(l.user_name || '—')}</td>
        <td>${esc(words[l.action] || l.action)} ${esc({ quiz: 'quiz question', timeline: 'timeline event' }[l.entity] || l.entity)}: <b>${esc(l.label || '#' + l.entity_id)}</b></td></tr>`).join('')
        || '<tr><td colspan="3" class="muted">No changes yet.</td></tr>'}</tbody>
    </table></div>`;
}

function renderHelp() {
  $('#view').innerHTML = `
    <div class="panel help">
      <h2>How content gets onto the website</h2>
      <ol>
        <li><b>Write it.</b> Add a fact or question, with a link to where you found it. It starts as <i>Needs check</i> and is hidden.</li>
        <li><b>Check it.</b> A different teammate opens the source link and makes sure it really says that.</li>
        <li><b>Verify it.</b> They press <i>Verify</i>. It goes live on the website straight away.</li>
        <li><b>Change it.</b> If anyone changes the words of a live item, it goes back to <i>Needs check</i> until someone else verifies it again.</li>
      </ol>
      <p>Every step is saved in <b>History</b>, with who did it and when.</p>
      <p>Learners earn points: 10 for each new city, 5 for each part of a letter they read, and 10 for each correct answer on their best quiz.</p>
    </div>`;
}

// ---------------------------------------------------------------- places (Aksh's heritage list)
// There can be hundreds per city, so this tab loads them on its own and has a search box.
async function renderPlaces() {
  $('#view').innerHTML = '<p class="muted">Loading places…</p>';
  const r = await api(`/api/admin/cities/${encodeURIComponent(state.city)}/places`);
  if (!r.ok) { $('#view').innerHTML = `<p class="form-error">${esc(r.data.error)}</p>`; return; }
  const all = r.data.places;
  const words = (p) => `${p.name} ${p.native_name} ${p.subcategory} ${p.description}`.toLowerCase();
  const match = (p) => shown(p) && (!state.placeSearch || words(p).includes(state.placeSearch));
  const map = (p) => (p.latitude == null ? '<span class="badge">No map position</span>'
    : `<a class="src" href="https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}" target="_blank" rel="noopener">Map: ${p.latitude}, ${p.longitude}</a>`);
  const extra = (p) => Object.entries(p.details || {}).map(([k, v]) => `<tr><th>${esc(k.replace(/_/g, ' '))}</th><td>${esc(v)}</td></tr>`).join('');
  $('#view').innerHTML = `
    <div class="row"><p class="muted" style="margin:0">Heritage places from Aksh's research, each with a map position. Check the name, the description and the position against the source, then verify.
      "Aksh's notes" says how sure the research was.</p>
      <span class="spacer"></span><button class="btn primary" id="addPlace">+ Add a place</button></div>
    ${filters(all)}
    <input id="placeSearch" placeholder="Search by name or type" value="${esc(state.placeSearch)}" style="max-width:360px;margin-bottom:10px">
    <div id="placeList"></div>`;
  const list = () => {
    const items = all.filter(match);
    $('#placeList').innerHTML = items.map((p) => `
      <article class="item ${p.status === 'verified' ? 'verified' : ''}">
        <h4>${esc(p.name)}${p.native_name ? ` <span class="muted" style="font-weight:400">${esc(p.native_name)}</span>` : ''} ${badge(p)}</h4>
        <div class="meta">${esc([p.subcategory, p.year, p.code].filter(Boolean).join(' · '))}</div>
        ${p.description ? `<p>${esc(p.description)}</p>` : '<p class="muted">No description yet.</p>'}
        ${p.source_url ? `<a class="src" href="${esc(p.source_url)}" target="_blank" rel="noopener">${esc(p.source_url)}</a>` : '<span class="badge">No source yet</span>'}
        ${map(p)}
        <div class="meta">Aksh's notes: ${esc([p.research_status, p.confidence && `${p.confidence} confidence`].filter(Boolean).join(', ') || 'none')}</div>
        ${extra(p) ? `<details><summary class="muted">All research columns</summary><div class="table-wrap"><table>${extra(p)}</table></div></details>` : ''}
        <div class="meta">${people(p).replace('imported from the old site', "imported from Aksh's workbook")}</div>
        ${itemButtons('places', p)}
      </article>`).join('') || '<p class="muted">Nothing here.</p>';
    wireItems('places', items, editPlace);
  };
  wireFilters();
  $('#placeSearch').oninput = (e) => { state.placeSearch = e.target.value.trim().toLowerCase(); list(); };
  $('#addPlace').onclick = () => editPlace(null);
  list();
}

function editPlace(p) {
  openForm(p ? 'Edit place' : 'Add a place', [
    { name: 'name', label: 'Name', type: 'text', value: p?.name ?? '' },
    { name: 'subcategory', label: 'Type', type: 'text', value: p?.subcategory ?? '', hint: 'e.g. Lakes (Jheel), Museums & Galleries' },
    { name: 'description', label: 'Description', type: 'textarea', value: p?.description ?? '', hint: 'one or two short sentences' },
    { name: 'latitude', label: 'Latitude', type: 'text', value: p?.latitude ?? '', hint: 'e.g. 24.5764 (right-click the place on openstreetmap.org to copy it)' },
    { name: 'longitude', label: 'Longitude', type: 'text', value: p?.longitude ?? '', hint: 'e.g. 73.6835' },
    { name: 'sourceUrl', label: 'Source link', type: 'url', value: p?.source_url ?? '', hint: 'where a teammate can check this' },
  ], async (v) => {
    const body = { ...v, cityId: state.city };
    const r = p ? await api(`/api/admin/places/${p.id}`, body, 'PUT') : await api('/api/admin/places', body);
    if (!r.ok) return r.data.error;
    toast(r.data.backToCheck ? 'Saved. Because it changed, it needs to be checked again.' : p ? 'Saved.' : 'Added. A teammate now needs to verify it.');
    refresh();
  });
}

boot();
