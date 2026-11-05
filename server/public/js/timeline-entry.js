// One timeline entry. Every event on every city's timeline is drawn by this one function, so they all
// look and read the same: the large year with its orange underline, the title, ONE paragraph, the source
// link(s) and the "X of N" counter. There are no extra boxes or labelled blocks: anything worth saying
// about an event goes into its paragraph.
//
// An event may have a second source (stored in memory_source_url). Two different links are shown on one
// line, "Sources: 1 · 2", in the same style as a single "Source" link; the same link twice is shown once.

const isLink = (u) => /^https?:\/\//i.test(String(u || ''));

export function entrySources(e) {
  return [...new Set([e.src, e.src2].filter(isLink))];
}

export function sourcesHTML(e, esc) {
  const links = entrySources(e);
  const a = (href, label) => `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;
  if (!links.length) return '';
  if (links.length === 1) return `<p class="ev-src">${a(links[0], 'Source')}</p>`;
  return `<p class="ev-src">Sources: ${links.map((u, k) => a(u, k + 1)).join(' · ')}</p>`;
}

export function timelineEntryHTML(e, i, n, esc) {
  return `
    <p class="ev-year${String(e.year).length > 5 ? ' long' : ''}">${esc(e.year)}</p>
    <h3>${esc(e.title)}</h3>
    <p class="ev-text">${esc(e.text)}</p>
    ${sourcesHTML(e, esc)}
    <p class="ev-count">${i + 1} of ${n}${e.draft ? ' · <span class="draft">draft, not yet checked</span>' : ''}</p>`;
}

// On a phone the photo sits above the entry's text. When a longer paragraph leaves less room, every entry
// is handled the same way: the photo shrinks to fit the space between the top buttons and the text, and
// is left out only when there is no useful room (under 90 px wide). If the text itself is taller than the
// screen, it scrolls inside its own area instead of running under the buttons. The font never shrinks.
export function fitEntryOnPhone(info, media, topEl) {
  info.style.maxHeight = ''; info.style.overflowY = '';
  for (const f of media.children) { f.style.width = ''; f.style.top = ''; f.classList.remove('no-room'); }
  if (innerWidth >= 720) return;
  const limit = (topEl?.getBoundingClientRect().bottom || 60) + 8;
  const box = info.getBoundingClientRect();
  if (box.top < limit) {
    info.style.maxHeight = `${Math.floor(box.bottom - limit)}px`;
    info.style.overflowY = 'auto';
  }
  const textTop = Math.max(limit, box.top);
  for (const f of media.querySelectorAll('.snap, .element')) {
    const r = f.getBoundingClientRect();
    if (!r.height || getComputedStyle(f).display === 'none' || r.bottom <= textTop - 8) continue;
    const room = textTop - 8 - limit;
    const w = (f.offsetWidth * room) / r.height;
    if (w < 90) { f.classList.add('no-room'); continue; }
    f.style.top = `${limit - media.getBoundingClientRect().top}px`;
    f.style.width = `${Math.floor(w)}px`;
  }
}
