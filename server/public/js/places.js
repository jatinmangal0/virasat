// Heritage places on the city map: marigolds coloured by kind, clusters where pins crowd, a list view,
// and a card for each place with its photo credited. Places come from the team's research (the Places tab).
import { $, $$ } from './lib.js';

// what city.js shares: its ctx, the open city (cur) and relayout()
let ctx, cur, layoutAfterOpen;
export function initPlaces(shared) { ({ ctx, cur, relayout: layoutAfterOpen } = shared); }

// Places come from the team's research (the Places tab on the editor page): the checked ones, plus
// drafts in demo mode. Each sits on the outline map as a marigold, coloured by what kind of place it is.
const PLACE_KINDS = [
  ['built', 'Buildings', /built|architecture|fortif/i],
  ['culture', 'Living culture', /living|intangible|culinary|craft|perform/i],
  ['nature', 'Lakes and nature', /hydro|ecolog|natural|landscape/i],
  ['civic', 'Institutions', /institution|civic|sport|archive|literary/i],
];
const kindOf = (p) => (PLACE_KINDS.find((k) => k[2].test(p.category || '')) || PLACE_KINDS[0])[0];

// Commons "Special:FilePath" links become a sized https image, plus the file's page for the credit.
function photoOf(url) {
  const m = /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/(.+)$/i.exec(url || '');
  if (m) return { src: `https://commons.wikimedia.org/wiki/Special:FilePath/${m[1]}?width=640`, page: `https://commons.wikimedia.org/wiki/File:${m[1]}` };
  return /^https:\/\//i.test(url || '') ? { src: url, page: url } : null;
}

export async function loadPlaces(run) {
  const r = await ctx.api(`/api/cities/${run.id}/places`);
  const list = [...(r.ok ? r.data.places : []), ...(ctx.state.demo?.places?.[run.id] || [])]
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  if (cur() !== run || !list.length) return;
  // described places are drawn last, so they sit on top
  run.places = list.sort((a, b) => !!a.description - !!b.description);
  if (run.story) { renderPlaces(); layoutAfterOpen(); }
}

// A place the team has not written about yet (no description, no photo) is "bare": kept off the map
// unless the visitor asks for every researched place, so the map shows what it can explain.
const isBare = (p) => !p.description && !p.image_url;

export function renderPlaces() {
  const { esc } = ctx, list = cur().places;
  if (!list.length) return;
  const told = list.filter((p) => !isBare(p));
  const count = Object.fromEntries(PLACE_KINDS.map((k) => [k[0], told.filter((p) => kindOf(p) === k[0]).length]));
  const bare = list.length - told.length;
  $('#placeLegend').innerHTML = PLACE_KINDS.filter((k) => count[k[0]])
    .map(([id, label]) => `<button class="chip k-${id}" data-kind="${id}" aria-pressed="true"><i></i>${label} <b>${count[id]}</b></button>`).join('')
    + (bare ? `<button class="chip bare-chip" data-bare aria-pressed="false">All researched <b>+${bare}</b></button>` : '')
    + '<button class="chip list-chip" data-list>List</button>';
  $('#places').innerHTML = list.map((p, i) => `<button class="pp k-${kindOf(p)}${p.description ? ' big' : ''}${isBare(p) ? ' bare' : ''}" data-i="${i}"
      style="--d:${(i % 40) * 18}ms" aria-label="${esc(p.name)}" tabindex="-1"><span class="pp-name">${esc(p.name)}</span></button>`).join('');
  $$('#places .pp').forEach((b) => b.addEventListener('click', () => showPlace(Number(b.dataset.i))));
  $$('#placeLegend [data-kind]').forEach((b) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on);
    $('#places').classList.toggle('hide-' + b.dataset.kind, !on);
    placePins();
  }));
  $('#placeLegend [data-bare]')?.addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', on);
    $('#places').classList.toggle('show-bare', on);
    placePins();
  });
  $('#placeLegend [data-list]').addEventListener('click', () => showList(null));
  // wide screens open on a place with a photo and a description, so the card is never empty
  if (innerWidth >= 720) {
    const pick = list.findLastIndex((p) => p.description && photoOf(p.image_url));
    showPlace(pick >= 0 ? pick : list.findLastIndex((p) => p.description));
  }
}

// Places sit on the map where they are. Pins closer than a fingertip are gathered into one numbered
// cluster; tapping it lists them. Places outside the map's frame are listed but not pinned.
export function placePins() {
  const s = cur().story;
  if (!s?.outline?.project) return;
  const box = $('#places');
  $$('.pp-cluster', box).forEach((c) => c.remove());
  const R = s.g.mob ? 26 : 16, groups = [];
  const kindHidden = (p) => box.classList.contains('hide-' + kindOf(p)) || (isBare(p) && !box.classList.contains('show-bare'));
  // described places first, so they lead their cluster
  const order = $$('.pp', box).sort((a, b) => !!cur().places[b.dataset.i].description - !!cur().places[a.dataset.i].description);
  for (const b of order) {
    const p = cur().places[b.dataset.i], xy = s.outline.project(p.longitude, p.latitude);
    b.hidden = !xy;
    b.classList.remove('in-cluster');
    if (!xy) continue;
    b.style.left = xy[0] + 'px'; b.style.top = xy[1] + 'px';
    if (kindHidden(p)) continue;
    const g = groups.find((q) => Math.hypot(q.x - xy[0], q.y - xy[1]) < R);
    if (g) g.items.push(b); else groups.push({ x: xy[0], y: xy[1], items: [b] });
  }
  for (const g of groups.filter((q) => q.items.length > 1)) {
    g.items.forEach((b) => b.classList.add('in-cluster'));
    const ids = g.items.map((b) => Number(b.dataset.i));
    box.insertAdjacentHTML('beforeend', `<button class="pp-cluster" style="left:${g.x}px;top:${g.y}px" data-ids="${ids.join(',')}"
      aria-label="${ids.length} places here">${ids.length}</button>`);
  }
  $$('.pp-cluster', box).forEach((c) => c.addEventListener('click', () => showList(c.dataset.ids.split(',').map(Number))));
  const shown = groups.reduce((n, q) => n + q.items.length, 0), drafts = cur().places.some((p) => p.draft);
  $('#mapNote').textContent = `${shown} heritage places on the map${drafts ? ' (drafts, not yet checked)' : ''}. Tap a marigold, or open the list.`;
}

// The places as a list: everything on the map, or the ones in a cluster. Easier on a phone, and for screen readers.
function showList(ids) {
  const { esc } = ctx, panel = $('#placeList'), box = $('#places');
  const visible = (p) => !box.classList.contains('hide-' + kindOf(p)) && (!isBare(p) || box.classList.contains('show-bare'));
  const items = (ids || cur().places.map((_, i) => i).filter((i) => visible(cur().places[i])))
    .sort((a, b) => cur().places[a].name.localeCompare(cur().places[b].name));
  $('#placeCard').hidden = true;
  panel.innerHTML = `<div class="pl-head"><b>${ids ? `${items.length} places here` : `${items.length} places`}</b>
      <button class="pc-close" aria-label="Close the list">×</button></div>
    <ul>${items.map((i) => { const p = cur().places[i]; return `<li><button data-i="${i}"><i class="k-${kindOf(p)}"></i><span>${esc(p.name)}
      <small>${esc(p.subcategory || 'Heritage place')}${p.description ? '' : ' · not written yet'}</small></span></button></li>`; }).join('')}</ul>`;
  panel.hidden = false;
  $('.pc-close', panel).addEventListener('click', () => { panel.hidden = true; });
  $$('li button', panel).forEach((b) => b.addEventListener('click', () => { panel.hidden = true; showPlace(Number(b.dataset.i)); }));
  $('li button', panel)?.focus({ preventScroll: true });
}

function showPlace(i) {
  const { esc } = ctx, p = cur().places[i], card = $('#placeCard');
  if (!p) return;
  cur().story.place = i;
  $('#placeList').hidden = true;
  $$('#places .pp').forEach((b) => b.classList.toggle('sel', Number(b.dataset.i) === i));
  const photo = photoOf(p.image_url);
  card.innerHTML = `
    <button class="pc-close" aria-label="Close">×</button>
    ${photo ? `<figure class="pc-photo"><img src="${esc(photo.src)}" alt="${esc(p.name)}" loading="lazy">
      <figcaption><a href="${esc(photo.page)}" target="_blank" rel="noopener">Photo: ${esc(p.image_license && !/^See /.test(p.image_license) ? p.image_license : 'Wikimedia Commons')}</a></figcaption></figure>` : ''}
    <p class="pc-kind k-${kindOf(p)}"><i></i>${esc(p.subcategory || 'Heritage place')}${p.year ? ` · since ${esc(p.year)}` : ''}</p>
    <h4>${esc(p.name)}</h4>
    ${p.native_name ? `<p class="pc-native">${esc(p.native_name)}</p>` : ''}
    <p class="pc-text">${p.description ? esc(p.description) : 'Our team is still writing about this place.'}</p>
    <p class="pc-foot">${p.source_url ? `<a href="${esc(p.source_url)}" target="_blank" rel="noopener">Source</a>` : ''}${p.draft ? '<span class="draft">draft, not yet checked</span>' : ''}</p>`;
  card.hidden = false;
  $('img', card)?.addEventListener('error', (ev) => ev.target.closest('figure').remove());
  $('.pc-close', card).addEventListener('click', () => { card.hidden = true; $$('#places .pp.sel').forEach((b) => b.classList.remove('sel')); });
  card.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
}

