// Gives each city its own address, like virasat-psi.vercel.app/udaipur, before anyone opens it.
//
//   node scripts/build-pages.js           (Vercel runs this after the migrations, on every build)
//
// For each published city it writes server/public/<city>/index.html: the same page as the home page, but
// with the city's own title, description, share card (Open Graph) and a structured-data summary for search
// engines, plus the city's checked text inside <noscript> for readers and crawlers without JavaScript.
// When the page loads, app.js sees the address and walks straight into that city.
// It also writes each city's Explore page (server/public/<city>/explore/index.html) and sitemap.xml. If the database cannot be reached it says so and leaves the old files alone,
// so the build still works (the address then falls back to the home page, see vercel.json).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadPublicCities } from '../server/api/content.js';

const publicDir = fileURLToPath(new URL('../server/public/', import.meta.url));
export const SITE = (process.env.SITE_URL || 'https://virasat-psi.vercel.app').replace(/\/$/, '');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const firstSentence = (s) => (String(s).match(/^[^.!?]+[.!?]/) || [s])[0].trim();

// The home page with this city's head tags and readable text. Pure: same city in, same page out.
// sub = 'explore' makes the city's Explore page (/kolkata/explore): the map, later flashcards and games.
export function cityPage(template, city, site = SITE, sub = '') {
  const url = `${site}/${city.id}${sub ? `/${sub}` : ''}`;
  const title = sub === 'explore' ? `Explore ${city.name}: map of heritage places | Virasat` : `${city.name} · ${city.nickname || 'Virasat'} | Virasat`;
  const desc = `${firstSentence(city.letter[0] || '')} Walk into ${city.name} with Gaju the elephant: a letter, fact cards, a timeline and a map, every fact checked against a source.`.slice(0, 300);
  const image = `${site}/assets/og-${city.id}.png`;
  const data = {
    '@context': 'https://schema.org', '@type': 'TouristDestination', name: city.name, alternateName: city.native || undefined,
    description: city.letter.join(' '), url, image,
    containedInPlace: city.state ? { '@type': 'State', name: city.state } : undefined,
    includesAttraction: city.sections.find((s) => s.id === 'landmarks')?.items.map((f) => ({ '@type': 'TouristAttraction', name: f.title, description: f.text })),
  };
  // the home page already carries <base href="/">, so relative links work from /kolkata and /kolkata/explore
  const head = `<title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website"><meta property="og:site_name" content="Virasat">
  <meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}"><meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
  const facts = city.sections.flatMap((s) => s.items.map((f) => `<li><b>${esc(f.title)}.</b> ${esc(f.text)}${f.src ? ` <a href="${esc(f.src)}">Source</a>` : ''}</li>`));
  const text = `<noscript><article class="static-city">
      <h1>${esc(city.name)} ${city.native ? `(${esc(city.native)})` : ''}</h1>
      ${city.letter.map((p) => `<p>${esc(p)}</p>`).join('')}
      <ul>${city.quickFacts.map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join('')}</ul>
      ${facts.length ? `<h2>Inside the letter</h2><ul>${facts.join('')}</ul>` : ''}
      ${city.timeline.length ? `<h2>Through the years</h2><ol>${city.timeline.map((e) => `<li><b>${esc(e.year)}: ${esc(e.title)}.</b> ${esc(e.text)}</li>`).join('')}</ol>` : ''}
      <p>Sources: ${city.sources.map(([t, u]) => `<a href="${esc(u)}">${esc(t)}</a>`).join(' · ')}</p>
    </article></noscript>`;
  return template
    .replace(/<title>[\s\S]*?<\/title>\s*<meta name="description"[^>]*>/, head)
    .replace('<main>', `<main>\n    ${text}`);
}

export function sitemap(cities, site = SITE) {
  const urls = ['', ...cities.flatMap((c) => [c.id, `${c.id}/explore`])].map((p) => `  <url><loc>${site}/${p}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let db;
  try {
    const { makePool } = await import('../server/lib/db.js');
    db = makePool();
    const cities = await loadPublicCities(db);
    const template = readFileSync(publicDir + 'index.html', 'utf8');
    for (const c of cities) {
      mkdirSync(publicDir + c.id, { recursive: true });
      writeFileSync(`${publicDir}${c.id}/index.html`, cityPage(template, c));
      mkdirSync(`${publicDir}${c.id}/explore`, { recursive: true });
      writeFileSync(`${publicDir}${c.id}/explore/index.html`, cityPage(template, c, SITE, 'explore'));
    }
    writeFileSync(publicDir + 'sitemap.xml', sitemap(cities));
    console.log(`Wrote pages for ${cities.map((c) => c.id).join(', ')} and sitemap.xml.`);
  } catch (e) {
    console.log(`Skipping city pages: ${e.message}`);
  } finally {
    await db?.end();
  }
}
