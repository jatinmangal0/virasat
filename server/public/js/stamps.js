// Virasat Dak: the site's own postage stamps, drawn in SVG so they stay sharp at any size and
// carry no outside artwork. Each city prints in two inks plus paper, like a screen-printed stamp:
//   Udaipur: lapis blue and lac red      Kolkata: vermilion and lamp black
// They are inline SVG (not <img>), so the page's own fonts draw the city names in their scripts.
// The value is in the city's own numerals (५, ৫). They are Virasat's stamps, not India Post's.

const W = 300, H = 380;

// Holes punched round the edge, so the stamp reads as torn from a sheet.
function perforation(id) {
  let holes = '';
  for (let x = 7; x < W; x += 14) holes += `<circle cx="${x}" cy="0" r="5"/><circle cx="${x}" cy="${H}" r="5"/>`;
  for (let y = 7; y < H; y += 14) holes += `<circle cx="0" cy="${y}" r="5"/><circle cx="${W}" cy="${y}" r="5"/>`;
  return `<mask id="${id}-perf"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${holes}</g></mask>`;
}

// Fine parallel lines, the stamp's stand-in for engraving.
const hatch = (id, ink, gap, angle, width = 1) =>
  `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><path d="M0 ${gap / 2}h${gap}" stroke="${ink}" stroke-width="${width}"/></pattern>`;

const pointedArch = (x, y, w, h) =>
  `M${x},${y + h} V${y + h * 0.45} Q${x},${y + h * 0.1} ${x + w / 2},${y} Q${x + w},${y + h * 0.1} ${x + w},${y + h * 0.45} V${y + h} Z`;

function frame({ id, paper, ink, accent, value, native, nativeFont, latin, scene }) {
  return `<svg class="dak" viewBox="0 0 ${W} ${H}" role="img" aria-label="Virasat Dak stamp: ${latin.split(' ·')[0]}">
  <defs>${perforation(id)}
    ${hatch(`${id}-h`, ink, 4, 0, 0.9)}${hatch(`${id}-d`, ink, 5, 45, 1.1)}${hatch(`${id}-x`, ink, 3, -30, 0.8)}
    <clipPath id="${id}-win"><rect x="24" y="44" width="252" height="232"/></clipPath>
  </defs>
  <g mask="url(#${id}-perf)">
    <rect width="${W}" height="${H}" fill="${paper}"/>
    <rect x="14" y="14" width="272" height="352" fill="none" stroke="${ink}" stroke-width="3"/>
    <rect x="19.5" y="19.5" width="261" height="341" fill="none" stroke="${ink}" stroke-width="1"/>
    <text x="28" y="36" font-family="Anek Latin, sans-serif" font-weight="700" font-size="12" letter-spacing="3.2" fill="${ink}">VIRASAT DAK</text>
    <circle cx="258" cy="31" r="13" fill="${accent}"/>
    <text x="258" y="37" text-anchor="middle" font-family="${nativeFont}" font-weight="700" font-size="17" fill="${paper}">${value}</text>
    <g clip-path="url(#${id}-win)">${scene}</g>
    <rect x="24" y="44" width="252" height="232" fill="none" stroke="${ink}" stroke-width="1.5"/>
    <rect x="24" y="284" width="252" height="70" fill="${accent}"/>
    <text x="150" y="324" text-anchor="middle" font-family="${nativeFont}" font-weight="700" font-size="36" fill="${paper}">${native}</text>
    <text x="150" y="344" text-anchor="middle" font-family="Anek Latin, sans-serif" font-weight="600" font-size="10.5" letter-spacing="2.6" fill="${paper}">${latin}</text>
  </g>
</svg>`;
}

// ---------------------------------------------------------------- Udaipur
// The City Palace along the east bank of Lake Pichola, the Lake Palace on the water,
// the Aravalli hills behind and a setting sun. Lapis and lac on paper.
function udaipurScene(id, ink, red, paper) {
  let palace = `<path d="M150,206 V166 h16 v-10 h14 v10 h20 v-18 h18 v18 h24 v-8 h16 v8 h20 V206 Z" fill="${ink}"/>`;
  // domes and chhatris along the roofline
  for (const [cx, base, w] of [[173, 156, 14], [209, 148, 18], [246, 158, 12], [272, 166, 12]]) {
    palace += `<path d="M${cx - w / 2},${base} Q${cx - w / 2},${base - w * 0.9} ${cx},${base - w} Q${cx + w / 2},${base - w * 0.9} ${cx + w / 2},${base} Z" fill="${ink}"/>
      <line x1="${cx}" y1="${base - w}" x2="${cx}" y2="${base - w - 5}" stroke="${ink}" stroke-width="1.4"/>`;
  }
  // rows of jharokha windows cut out in paper
  for (let row = 0; row < 3; row++) {
    for (let x = 156; x < 282; x += 11) {
      if (row === 0 && (x < 170 || x > 236)) continue;
      palace += `<path d="${pointedArch(x, 170 + row * 12, 5, 8)}" fill="${paper}"/>`;
    }
  }
  const lakePalace = `<g>
    <rect x="70" y="214" width="62" height="12" fill="${paper}" stroke="${ink}" stroke-width="1.4"/>
    <rect x="80" y="205" width="40" height="9" fill="${paper}" stroke="${ink}" stroke-width="1.4"/>
    <path d="M92,205 Q92,195 100,193 Q108,195 108,205 Z" fill="${paper}" stroke="${ink}" stroke-width="1.4"/>
    ${[76, 86, 96, 106, 116, 126].map((x) => `<path d="${pointedArch(x - 2, 217, 4, 7)}" fill="${ink}"/>`).join('')}
  </g>`;
  let ripples = '';
  for (let i = 0; i < 9; i++) ripples += `<path d="M${30 + (i * 37) % 230},${236 + i * 4.5} h${14 + (i % 3) * 8}" stroke="${paper}" stroke-width="2" stroke-linecap="round"/>`;
  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="${paper}"/>
    <rect x="24" y="44" width="252" height="160" fill="url(#${id}-h)" opacity=".35"/>
    <circle cx="96" cy="128" r="30" fill="${red}"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="60" y="${132 + i * 6}" width="72" height="2.4" fill="${paper}"/>`).join('')}
    <path d="M24,176 Q60,128 104,156 T182,140 T276,150 V206 H24 Z" fill="url(#${id}-d)"/>
    <path d="M24,190 Q80,160 130,182 T276,176 V206 H24 Z" fill="${ink}" opacity=".85"/>
    ${palace}
    <rect x="24" y="206" width="252" height="70" fill="url(#${id}-h)"/>
    ${lakePalace}
    ${ripples}
    <path d="M192,252 q14,7 30,0 l-5,6 h-20 Z" fill="${red}"/>
    <line x1="207" y1="252" x2="207" y2="238" stroke="${ink}" stroke-width="1.4"/>`;
}

// ---------------------------------------------------------------- Kolkata
// Howrah Bridge (a cantilever with no nuts and bolts, only rivets) over the Hooghly at dusk,
// a country boat with its sail up. Vermilion and black on paper.
function kolkataScene(id, ink, red, paper) {
  const deck = 208;
  // the top chord: anchor arms rise to the towers, then dip to the suspended span in the middle
  const chord = [[24, 176], [70, 82], [128, 150], [172, 150], [230, 82], [276, 176]];
  const at = (x) => { // height of the top chord at x
    for (let i = 0; i < chord.length - 1; i++) {
      const [x0, y0] = chord[i], [x1, y1] = chord[i + 1];
      if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return deck;
  };
  let truss = `<polyline points="${chord.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    <line x1="24" y1="${deck}" x2="276" y2="${deck}" stroke="${ink}" stroke-width="5"/>`;
  // a riveted truss: an inner chord follows the top one, with posts and X-bracing between them
  const band = (x) => Math.min(deck - 2, at(x) + 16);
  truss += `<polyline points="${Array.from({ length: 64 }, (_, i) => { const x = 24 + (i * 252) / 63; return `${x},${band(x)}`; }).join(' ')}" fill="none" stroke="${ink}" stroke-width="2"/>`;
  for (let x = 28; x < 276; x += 9) {
    const x2 = Math.min(276, x + 9);
    truss += `<line x1="${x}" y1="${band(x)}" x2="${x}" y2="${at(x)}" stroke="${ink}" stroke-width="1.4"/>
      <line x1="${x}" y1="${at(x)}" x2="${x2}" y2="${band(x2)}" stroke="${ink}" stroke-width=".9"/>
      <line x1="${x}" y1="${band(x)}" x2="${x2}" y2="${at(x2)}" stroke="${ink}" stroke-width=".9"/>
      <line x1="${x}" y1="${deck}" x2="${x}" y2="${band(x)}" stroke="${ink}" stroke-width=".7" opacity=".7"/>`;
  }
  // the two great towers
  for (const tx of [70, 230]) truss += `<path d="M${tx - 7},${deck + 4} L${tx - 3},72 h6 L${tx + 7},${deck + 4} Z" fill="${ink}"/>`;
  let ripples = '';
  for (let i = 0; i < 10; i++) ripples += `<path d="M${28 + (i * 41) % 236},${226 + i * 4.6} h${12 + (i % 4) * 7}" stroke="${paper}" stroke-width="2" stroke-linecap="round"/>`;
  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="${paper}"/>
    <rect x="24" y="44" width="252" height="164" fill="url(#${id}-x)" opacity=".28"/>
    <circle cx="150" cy="150" r="34" fill="${red}"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="110" y="${150 + i * 6}" width="80" height="2.4" fill="${paper}"/>`).join('')}
    <path d="M24,196 h30 v-10 h12 v10 h20 v-6 h14 v6 h120 v-8 h12 v8 h44 V210 H24 Z" fill="${ink}" opacity=".35"/>
    ${truss}
    <rect x="24" y="212" width="252" height="64" fill="url(#${id}-h)"/>
    ${ripples}
    <g>
      <path d="M96,256 q26,10 56,0 l-6,8 h-44 Z" fill="${ink}"/>
      <line x1="122" y1="256" x2="122" y2="226" stroke="${ink}" stroke-width="1.6"/>
      <path d="M123,227 L144,250 H123 Z" fill="${red}"/>
    </g>`;
}

const CITY_STAMPS = {
  udaipur: (id) => {
    const ink = '#24408f', red = '#b5281c', paper = '#f8f1e2';
    return frame({ id, paper, ink, accent: red, value: '५', native: 'उदयपुर', nativeFont: 'Anek Devanagari, sans-serif',
      latin: 'UDAIPUR · CITY OF LAKES', scene: udaipurScene(id, ink, red, paper) });
  },
  kolkata: (id) => {
    const ink = '#1f1a17', red = '#c8402a', paper = '#f6efe2';
    return frame({ id, paper, ink, accent: ink, value: '৫', native: 'কলকাতা', nativeFont: 'Anek Bangla, sans-serif',
      latin: 'KOLKATA · ON THE HOOGHLY', scene: kolkataScene(id, ink, red, paper) });
  },
};

// The stamp for a city as inline SVG. Each copy gets its own ids: a pattern defined inside a hidden
// dialog would otherwise leave every other copy on the page blank.
// Cities without a drawn stamp fall back to their image.
// A city with an artwork stamp (from the team) shows that picture instead of the drawn one.
const IMAGE_STAMPS = { kolkata: 'assets/stamp-kolkata.webp' };
let copies = 0;
export function stampHTML(c, alt = '') {
  if (IMAGE_STAMPS[c.id]) return `<img class="stamp-img" src="${IMAGE_STAMPS[c.id]}" alt="${alt}" width="480" height="643" loading="lazy" decoding="async">`;
  if (CITY_STAMPS[c.id]) return CITY_STAMPS[c.id](`dak-${c.id}-${++copies}`);
  return c.stamp ? `<img src="${c.stamp}" alt="${alt}">` : '';
}
export const hasStamp = (id) => !!CITY_STAMPS[id];
