// The view through each city's gate, drawn large: what you fly into when Gaju reaches the arch.
// Same style as the street (flat colour, one ink line), same palette as the little portal in the gate,
// so the arch on the street and this scene read as one picture getting closer.
//   Udaipur: Lake Pichola at sunset, the City Palace on the east bank, the Lake Palace and Jag Mandir on the water.
//   Kolkata: Howrah Bridge over the Hooghly at dusk, a taxi and a bus crossing, country boats below.
// Each layer has data-depth, which city.js uses for a gentle parallax.
const INK = '#3a2420';
const VBW = 1600, VBH = 900;

const pointedArch = (x, y, w, h) =>
  `M${x},${y + h} V${y + h * 0.45} Q${x},${y + h * 0.1} ${x + w / 2},${y} Q${x + w},${y + h * 0.1} ${x + w},${y + h * 0.45} V${y + h} Z`;
const dome = (cx, base, w, fill) => {
  const h = w * 0.85;
  return `<path d="M${cx - w / 2},${base} Q${cx - w / 2},${base - h * 0.9} ${cx},${base - h} Q${cx + w / 2},${base - h * 0.9} ${cx + w / 2},${base} Z" fill="${fill}" stroke="${INK}" stroke-width="2.5"/>
    <line x1="${cx}" y1="${base - h}" x2="${cx}" y2="${base - h - w * 0.3}" stroke="${INK}" stroke-width="3"/>
    <circle cx="${cx}" cy="${base - h - w * 0.32}" r="${Math.max(3, w * 0.06)}" fill="#e9a825" stroke="${INK}" stroke-width="1.5"/>`;
};
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const layer = (depth, inner, cls = '') => `<g class="hero-layer ${cls}" data-depth="${depth}">${inner}</g>`;

function birds(list) {
  return list.map(([x, y], i) => `<path class="bird" style="--d:${i * 0.15}s" d="M${x - 12},${y} q6,-8 12,0 q6,-8 12,0" stroke="${INK}" stroke-width="2.6" fill="none"/>`).join('');
}
function ripples(list, color) {
  return list.map(([x, y, w], i) => `<path class="ripple" style="--d:${(i % 5) * 0.4}s" d="M${x},${y} h${w}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`).join('');
}

// ---------------------------------------------------------------- Udaipur
function udaipur(id) {
  const cream = '#fff6ea', blue = '#2b45a6', water = 562;
  // the City Palace: blocks stepping up along the east bank, rows of jharokhas, domes on top
  const blocks = [[860, 150, 170], [1010, 120, 220], [1130, 170, 250], [1300, 140, 205], [1440, 180, 160]];
  let palace = '';
  for (const [x, w, h] of blocks) {
    palace += rect(x, water - h, w, h, cream, `stroke="${INK}" stroke-width="2.5"`);
    for (let row = 0; row < Math.floor((h - 40) / 46); row++) {
      for (let wx = x + 14; wx < x + w - 18; wx += 26) {
        palace += `<path d="${pointedArch(wx, water - h + 30 + row * 46, 14, 26)}" fill="${blue}" stroke="${INK}" stroke-width="1.2"/>`;
      }
    }
    palace += rect(x - 4, water - h - 8, w + 8, 10, cream, `stroke="${INK}" stroke-width="2"`);
  }
  for (const [cx, base, w] of [[935, water - 178, 44], [1080, water - 228, 70], [1200, water - 258, 52], [1255, water - 258, 52], [1400, water - 213, 60], [1520, water - 168, 40]]) {
    palace += dome(cx, base, w, cream);
  }
  // balconies and a blue band like the gate's
  palace += rect(1130, water - 120, 250, 8, blue);

  const lakePalace = `
    ${rect(520, water + 40, 300, 40, cream, `stroke="${INK}" stroke-width="2.5"`)}
    ${rect(560, water + 8, 220, 32, cream, `stroke="${INK}" stroke-width="2.5"`)}
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<path d="${pointedArch(532 + i * 32, water + 50, 14, 24)}" fill="${blue}" stroke="${INK}" stroke-width="1.2"/>`).join('')}
    ${dome(610, water + 8, 34, cream)}${dome(670, water + 8, 50, cream)}${dome(730, water + 8, 34, cream)}
    <g opacity=".35">${rect(520, water + 82, 300, 26, '#fff6ea')}</g>`;

  const jagMandir = `
    <ellipse cx="250" cy="${water + 26}" rx="190" ry="20" fill="#4f8a3c" stroke="${INK}" stroke-width="2"/>
    ${[110, 160, 340, 395].map((x) => `<circle cx="${x}" cy="${water - 6}" r="30" fill="#4f8a3c" stroke="${INK}" stroke-width="2"/><circle cx="${x + 18}" cy="${water - 22}" r="22" fill="#6aa543"/>`).join('')}
    ${rect(190, water - 30, 120, 50, cream, `stroke="${INK}" stroke-width="2.5"`)}
    ${[0, 1, 2, 3].map((i) => `<path d="${pointedArch(200 + i * 28, water - 18, 14, 26)}" fill="${blue}" stroke="${INK}" stroke-width="1.2"/>`).join('')}
    ${dome(250, water - 30, 46, cream)}`;

  return `<svg class="hero-svg" viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd7b0"/><stop offset=".55" stop-color="#ffc59a"/><stop offset="1" stop-color="#f7a28a"/></linearGradient>
    <linearGradient id="${id}-lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f63b8"/><stop offset="1" stop-color="#1b2d68"/></linearGradient>
    <radialGradient id="${id}-sun"><stop offset="0" stop-color="#fff3c4"/><stop offset=".4" stop-color="#ffe2a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></radialGradient>
  </defs>
  ${layer(0.05, `${rect(-200, -200, 2000, 1300, `url(#${id}-sky)`)}
    <circle cx="700" cy="330" r="220" fill="url(#${id}-sun)"/><circle cx="700" cy="330" r="62" fill="#ffe8b4"/>
    ${birds([[420, 210], [460, 196], [500, 218], [1180, 160], [1220, 176]])}`)}
  ${layer(0.12, `<path d="M-200,${water} V400 Q20,300 260,370 T700,350 T1150,380 T1800,330 V${water} Z" fill="#c98a8a" opacity=".6"/>
    <path d="M-200,${water} V460 Q200,380 420,440 T900,430 T1800,420 V${water} Z" fill="#b5727c" opacity=".55"/>`)}
  ${layer(0.22, palace, 'hero-palace')}
  ${layer(0.3, `${rect(-200, water, 2000, 600, `url(#${id}-lake)`)}
    <path d="M640,${water + 4} h120 M610,${water + 30} h180 M660,${water + 62} h80 M630,${water + 104} h140" stroke="#ffe2a8" stroke-width="5" stroke-linecap="round" opacity=".8"/>
    ${ripples([[80, 640, 60], [300, 690, 80], [900, 650, 70], [1100, 720, 90], [1350, 660, 60], [200, 780, 100], [1000, 820, 80], [1450, 790, 70]], '#9fb5ea')}`)}
  ${layer(0.36, `${jagMandir}${lakePalace}`)}
  ${layer(0.5, `<g class="hero-boat"><path d="M300,700 q60,22 130,0 l-12,16 h-106 Z" fill="#7a4b2e" stroke="${INK}" stroke-width="2"/>
      <path d="M352,700 v-40 h34 v40" fill="#e0503c" stroke="${INK}" stroke-width="2"/></g>
    <g class="hero-boat slow"><path d="M1180,760 q50,18 104,0 l-10,13 h-84 Z" fill="#7a4b2e" stroke="${INK}" stroke-width="2"/></g>`)}
</svg>`;
}

// ---------------------------------------------------------------- Kolkata
function kolkata(id) {
  const steel = '#4a3b4a', deck = 520, river = 560;
  const towers = [330, 1270];
  // top chord: up from the anchorages to the tower tops, down to the suspended span in the middle
  const chord = [[-60, 420], [towers[0], 150], [700, 380], [900, 380], [towers[1], 150], [1660, 420]];
  const at = (x) => {
    for (let i = 0; i < chord.length - 1; i++) {
      const [x0, y0] = chord[i], [x1, y1] = chord[i + 1];
      if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return deck;
  };
  const band = (x) => Math.min(deck - 6, at(x) + 46);
  let truss = `<polyline points="${chord.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${steel}" stroke-width="12" stroke-linejoin="round"/>
    <polyline points="${Array.from({ length: 90 }, (_, i) => { const x = -60 + i * 20; return `${x},${band(x)}`; }).join(' ')}" fill="none" stroke="${steel}" stroke-width="6"/>`;
  for (let x = -60; x < 1660; x += 32) {
    const x2 = x + 32;
    truss += `<line x1="${x}" y1="${band(x)}" x2="${x}" y2="${at(x)}" stroke="${steel}" stroke-width="4"/>
      <line x1="${x}" y1="${at(x)}" x2="${x2}" y2="${band(x2)}" stroke="${steel}" stroke-width="2.6"/>
      <line x1="${x}" y1="${band(x)}" x2="${x2}" y2="${at(x2)}" stroke="${steel}" stroke-width="2.6"/>
      <line x1="${x}" y1="${deck}" x2="${x}" y2="${band(x)}" stroke="${steel}" stroke-width="2.2"/>`;
  }
  for (const tx of towers) truss += `<path d="M${tx - 26},${river + 10} L${tx - 10},120 h20 L${tx + 26},${river + 10} Z" fill="${steel}" stroke="${INK}" stroke-width="2"/>`;
  truss += rect(-200, deck, 2000, 16, steel) + rect(-200, deck + 16, 2000, 6, INK);

  const traffic = `
    <g class="hero-car"><rect x="0" y="${deck - 30}" width="66" height="26" rx="8" fill="#f5c518" stroke="${INK}" stroke-width="2"/>
      <rect x="22" y="${deck - 42}" width="24" height="12" rx="3" fill="#f5c518" stroke="${INK}" stroke-width="2"/></g>
    <g class="hero-car bus"><rect x="0" y="${deck - 50}" width="130" height="46" rx="6" fill="#3c8c5a" stroke="${INK}" stroke-width="2"/>
      ${[0, 1, 2, 3, 4].map((i) => rect(10 + i * 24, deck - 44, 16, 14, '#cfe3e6', `stroke="${INK}" stroke-width="1"`)).join('')}</g>`;

  const skyline = [[40, 120, 70], [170, 90, 110], [270, 140, 60], [430, 100, 90], [560, 80, 140], [980, 120, 80], [1110, 90, 120], [1360, 130, 70], [1500, 100, 100]]
    .map(([x, w, h]) => rect(x, river - h, w, h, '#a8687a', 'opacity=".55"')).join('')
    + `<path d="M600,${river - 140} q35,-60 70,0 Z" fill="#a8687a" opacity=".55"/>`;

  const nouka = (x, y, s, sail) => `<g transform="translate(${x},${y}) scale(${s})">
      <path d="M0,0 q80,26 170,0 l-18,20 h-134 Z" fill="#6b4a2e" stroke="${INK}" stroke-width="2.5"/>
      <line x1="84" y1="2" x2="84" y2="-120" stroke="${INK}" stroke-width="3"/>
      <path d="M86,-116 L150,-8 H86 Z" fill="${sail}" stroke="${INK}" stroke-width="2"/></g>`;

  return `<svg class="hero-svg" viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf9a"/><stop offset=".6" stop-color="#ffb47a"/><stop offset="1" stop-color="#f58b6b"/></linearGradient>
    <linearGradient id="${id}-river" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6a7e"/><stop offset="1" stop-color="#3a3150"/></linearGradient>
    <radialGradient id="${id}-sun"><stop offset="0" stop-color="#fff3c4"/><stop offset=".4" stop-color="#ffe2a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></radialGradient>
  </defs>
  ${layer(0.05, `${rect(-200, -200, 2000, 1300, `url(#${id}-sky)`)}
    <circle cx="560" cy="410" r="230" fill="url(#${id}-sun)"/><circle cx="560" cy="410" r="66" fill="#ffe2a8"/>
    ${birds([[300, 230], [340, 214], [380, 236], [1020, 190], [1060, 206], [1100, 186]])}`)}
  ${layer(0.12, skyline)}
  ${layer(0.22, `${truss}${traffic}`, 'hero-bridge')}
  ${layer(0.3, `${rect(-200, river + 22, 2000, 600, `url(#${id}-river)`)}
    <path d="M500,${river + 40} h120 M470,${river + 76} h180 M520,${river + 118} h80" stroke="#ffd6a0" stroke-width="5" stroke-linecap="round" opacity=".75"/>
    ${ripples([[100, 650, 70], [320, 720, 90], [800, 680, 70], [1000, 760, 100], [1300, 690, 70], [180, 820, 90], [1200, 840, 80]], '#b8a6c9')}`)}
  ${layer(0.5, `<g class="hero-boat">${nouka(180, 720, 1, '#c8402a')}</g><g class="hero-boat slow">${nouka(1150, 780, 0.8, '#f2b33d')}</g>`)}
</svg>`;
}

const SCENES = { udaipur, kolkata };
let copies = 0;
export const heroSVG = (id) => (SCENES[id] ? SCENES[id](`hero-${id}-${++copies}`) : '');
export const hasHero = (id) => !!SCENES[id];

// The gate's opening, as an SVG path in screen pixels: a pointed arch for Udaipur, a round one for Kolkata.
export function archPath(id, x, y, w, h) {
  if (id === 'kolkata') return `M${x},${y + h} V${y + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w},${y + w / 2} V${y + h} Z`;
  return pointedArch(x, y, w, h);
}
