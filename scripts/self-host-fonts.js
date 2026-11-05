// Copies the site's Google Fonts into server/public/fonts so visitors' browsers never contact Google for them.
// Run by hand when a font is added or changed:  node scripts/self-host-fonts.js
// It writes server/public/css/fonts.css (the main set) and server/public/css/fonts-scripts.css (the other Indian
// scripts, loaded only when a greeting needs them), plus the .woff2 files they point at. Commit all of them.
import { mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const PUBLIC = path.resolve(import.meta.dirname, '../server/public');
const FONTS = path.join(PUBLIC, 'fonts');
// A current browser's user agent, so Google returns woff2 files split by unicode-range.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const SETS = {
  'fonts.css': 'family=Anek+Latin:wdth,wght@100..125,400..800&family=Anek+Devanagari:wdth,wght@100..125,500..800&family=Anek+Bangla:wdth,wght@100..125,500..800&family=Tiro+Devanagari+Hindi:ital@0;1&family=Tiro+Bangla:ital@0;1&family=Kalam:wght@400;700&family=Bowlby+One&display=swap',
  'fonts-scripts.css': 'family=Anek+Tamil:wght@600&family=Anek+Kannada:wght@600&family=Anek+Telugu:wght@600&family=Anek+Malayalam:wght@600&family=Anek+Gujarati:wght@600&family=Anek+Gurmukhi:wght@600&family=Anek+Odia:wght@600&display=swap',
};

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer());
}

await mkdir(FONTS, { recursive: true });
const keep = new Set();
for (const [file, query] of Object.entries(SETS)) {
  let css = await get(`https://fonts.googleapis.com/css2?${query}`);
  const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2/g) || [])];
  for (const url of urls) {
    // e.g. .../s/aneklatin/v11/co3D...woff2 -> aneklatin-<hash>.woff2 (stable, short, unique)
    const family = url.split('/s/')[1].split('/')[0];
    const name = `${family}-${createHash('sha1').update(url).digest('hex').slice(0, 10)}.woff2`;
    await writeFile(path.join(FONTS, name), await get(url, 'buffer'));
    keep.add(name);
    css = css.split(url).join(`/fonts/${name}`);
  }
  const head = `/* Self-hosted copy of Google Fonts (SIL Open Font License). Made by scripts/self-host-fonts.js; do not edit by hand. */\n`;
  await writeFile(path.join(PUBLIC, 'css', file), head + css);
  console.log(`${file}: ${urls.length} font files`);
}
for (const f of await readdir(FONTS)) if (f.endsWith('.woff2') && !keep.has(f)) await unlink(path.join(FONTS, f));
