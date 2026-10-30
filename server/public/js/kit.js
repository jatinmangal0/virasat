// The Project Kit: one page about a city that a student can print, save as a PDF, copy or share.
// It is built from the same checked content as the letter (key facts, landmarks with their photos,
// the timeline, the sources), ends with lines to write what you learnt, and credits every photo.
const $ = (s, el = document) => el.querySelector(s);

export function openKit(c, { esc, user }) {
  const landmarks = (c.sections.find((s) => s.id === 'landmarks')?.items || []).slice(0, 3);
  const extras = c.sections.filter((s) => s.id !== 'landmarks').flatMap((s) => s.items.slice(0, 1).map((f) => ({ ...f, label: s.label })));
  const photos = [...(c.photos || []), ...landmarks.map((f) => f.image).filter(Boolean)].slice(0, 3);
  const sources = [...c.sources.map(([t, u]) => ({ t, u })), ...[...landmarks, ...extras].filter((f) => f.src).map((f) => ({ t: f.title, u: f.src }))];
  const credits = photos.map((p) => `${p.caption}: ${p.credit}`);
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const kit = $('#kit');
  kit.innerHTML = `
    <div class="kit-bar no-print">
      <button class="btn primary" id="kitPrint">Print or save as PDF</button>
      <button class="btn" id="kitCopy">Copy the text</button>
      <button class="btn" id="kitShare">Share the link</button>
      <button class="btn" id="kitClose">Close</button>
    </div>
    <article class="kit-page" aria-labelledby="kitTitle">
      <header class="kit-head">
        <div><p class="kit-kicker">Virasat Project Kit${user ? ` · ${esc(user.name)}` : ''}</p>
          <h2 id="kitTitle">${esc(c.name)} <span lang="${c.id === 'kolkata' ? 'bn' : 'hi'}">${esc(c.native)}</span></h2>
          <p class="kit-sub">${esc(c.state)} · ${esc(c.nickname)}</p></div>
      </header>
      <p class="kit-intro">${c.letter.map(esc).join(' ')}</p>
      <section><h3>Key facts</h3><dl class="kit-facts">${c.quickFacts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
      ${photos.length ? `<section class="kit-photos">${photos.map((p) => `<figure><img src="${esc(p.src)}" alt="${esc(p.caption)}"><figcaption>${esc(p.caption)}</figcaption></figure>`).join('')}</section>` : ''}
      ${landmarks.length ? `<section><h3>Landmarks</h3><ul>${landmarks.map((f) => `<li><b>${esc(f.title)}.</b> ${esc(f.text)}</li>`).join('')}</ul></section>` : ''}
      ${extras.length ? `<section><h3>Festivals, food and more</h3><ul>${extras.map((f) => `<li><b>${esc(f.title)}</b> (${esc(f.label)}). ${esc(f.text)}</li>`).join('')}</ul></section>` : ''}
      ${c.timeline.length ? `<section><h3>Through the years</h3><ol class="kit-time">${c.timeline.map((e) => `<li><b>${esc(e.year)}</b> ${esc(e.title)}</li>`).join('')}</ol></section>` : ''}
      <section class="kit-learnt"><h3>Three things I learnt</h3><ol><li></li><li></li><li></li></ol></section>
      <footer class="kit-foot">
        <p><b>Sources.</b> ${sources.map((s) => `${esc(s.t)}: ${esc(s.u)}`).join(' · ')}</p>
        ${credits.length ? `<p><b>Photos.</b> ${credits.map(esc).join(' · ')}</p>` : ''}
        <p>Made with Virasat on ${today}. Every fact on Virasat is checked against its source by a second person.</p>
      </footer>
    </article>`;
  kit.hidden = false;
  document.body.classList.add('kit-open');
  $('#kitClose').focus();
  const close = () => { kit.hidden = true; document.body.classList.remove('kit-open'); };
  $('#kitClose').onclick = close;
  $('#kitPrint').onclick = () => print();
  $('#kitCopy').onclick = async () => {
    try { await navigator.clipboard.writeText($('.kit-page', kit).innerText); $('#kitCopy').textContent = 'Copied'; }
    catch { $('#kitCopy').textContent = 'Select the text to copy it'; }
  };
  $('#kitShare').onclick = async () => {
    const url = `${location.origin}/${c.id}`;
    if (navigator.share) { try { await navigator.share({ title: `${c.name} · Virasat`, url }); } catch { /* closed */ } }
    else { try { await navigator.clipboard.writeText(url); $('#kitShare').textContent = 'Link copied'; } catch { $('#kitShare').textContent = url; } }
  };
  kit.onkeydown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
}
