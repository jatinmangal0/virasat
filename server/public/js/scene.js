// Draws the street as layered SVG. Every layer shares one 1600×900 coordinate space,
// so the 3D parallax can push layers apart in depth while they still line up at rest.
export const VB = { w: 1600, h: 900 };
export const GROUND = 640;   // building baseline
export const WALK_Y = 712;   // where Gaju's feet touch the pavement
export const GATES = { udaipur: 470, kolkata: 1135 };

const INK = '#3a2420';
const svg = (inner, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${inner}</svg>`;
const r = (x, y, w, h, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

// ---------- small parts ----------
const pointedArch = (x, y, w, h) =>
  `M${x},${y + h} V${y + h * 0.42} Q${x},${y + h * 0.12} ${x + w / 2},${y} Q${x + w},${y + h * 0.12} ${x + w},${y + h * 0.42} V${y + h} Z`;
const roundArch = (x, y, w, h) =>
  `M${x},${y + h} V${y + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w},${y + w / 2} V${y + h} Z`;

function dome(cx, base, w, fill = '#f4ead8', stroke = INK) {
  const h = w * 0.85;
  return `<path d="M${cx - w / 2},${base} Q${cx - w / 2},${base - h * 0.9} ${cx},${base - h} Q${cx + w / 2},${base - h * 0.9} ${cx + w / 2},${base} Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    <line x1="${cx}" y1="${base - h}" x2="${cx}" y2="${base - h - w * 0.28}" stroke="${stroke}" stroke-width="2.5"/>
    <circle cx="${cx}" cy="${base - h - w * 0.3}" r="${Math.max(2.5, w * 0.06)}" fill="#e9a825" stroke="${stroke}" stroke-width="1.5"/>`;
}

function chhatri(cx, base, w, fill = '#f4ead8') {
  const ph = w * 0.7;
  return `<g class="chhatri">
    ${r(cx - w / 2 - 4, base - 6, w + 8, 6, fill, `stroke="${INK}" stroke-width="2"`)}
    ${r(cx - w / 2 + 2, base - ph, 5, ph - 6, fill, `stroke="${INK}" stroke-width="1.5"`)}
    ${r(cx + w / 2 - 7, base - ph, 5, ph - 6, fill, `stroke="${INK}" stroke-width="1.5"`)}
    ${r(cx - w / 2 - 6, base - ph - 6, w + 12, 7, fill, `stroke="${INK}" stroke-width="2"`)}
    ${dome(cx, base - ph - 6, w * 0.9, fill)}
  </g>`;
}

function creeper(x, y, s = 1, flowers = '#e84a7f') {
  let out = '';
  const blobs = [[0, 0, 16], [14, 6, 13], [-12, 8, 12], [4, 18, 12], [20, 22, 9], [-6, 28, 8], [10, 36, 7]];
  for (const [dx, dy, rr] of blobs) out += `<circle cx="${x + dx * s}" cy="${y + dy * s}" r="${rr * s}" fill="${rr > 11 ? '#4f8a3c' : '#6aa543'}"/>`;
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, d = 6 + (i % 4) * 5;
    out += `<circle cx="${x + Math.cos(a) * d * s}" cy="${y + 10 * s + Math.sin(a) * d * s}" r="${2.6 * s}" fill="${flowers}"/>`;
  }
  return `<g class="sway">${out}</g>`;
}

function pottedPlant(x, base, s = 1) {
  return `<g>
    <path d="M${x - 14 * s},${base - 26 * s} h${28 * s} l-${4 * s},${26 * s} h-${20 * s} Z" fill="#c9653f" stroke="${INK}" stroke-width="2"/>
    <circle cx="${x}" cy="${base - 40 * s}" r="${16 * s}" fill="#4f8a3c"/>
    <circle cx="${x - 12 * s}" cy="${base - 32 * s}" r="${10 * s}" fill="#6aa543"/>
    <circle cx="${x + 12 * s}" cy="${base - 33 * s}" r="${10 * s}" fill="#6aa543"/>
  </g>`;
}

function person(x, base, { skin = '#a8693f', top = '#e0503c', bottom = '#2f3c6b', sari = false, s = 1 } = {}) {
  const h = 92 * s;
  const body = sari
    ? `<path d="M${x - 13 * s},${base} L${x - 9 * s},${base - h * 0.62} Q${x},${base - h * 0.7} ${x + 9 * s},${base - h * 0.62} L${x + 14 * s},${base} Z" fill="${top}" stroke="${INK}" stroke-width="1.5"/>
       <path d="M${x - 9 * s},${base - h * 0.62} Q${x + 2 * s},${base - h * 0.4} ${x + 14 * s},${base - h * 0.15}" stroke="#f2b33d" stroke-width="${3 * s}" fill="none"/>`
    : `<rect x="${x - 7 * s}" y="${base - h * 0.4}" width="${5 * s}" height="${h * 0.4}" fill="${bottom}"/>
       <rect x="${x + 2 * s}" y="${base - h * 0.4}" width="${5 * s}" height="${h * 0.4}" fill="${bottom}"/>
       <path d="M${x - 10 * s},${base - h * 0.32} L${x - 9 * s},${base - h * 0.68} Q${x},${base - h * 0.74} ${x + 9 * s},${base - h * 0.68} L${x + 10 * s},${base - h * 0.32} Z" fill="${top}" stroke="${INK}" stroke-width="1.5"/>`;
  return `<g>${body}
    <circle cx="${x}" cy="${base - h * 0.8}" r="${8 * s}" fill="${skin}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M${x - 8 * s},${base - h * 0.82} Q${x},${base - h * 0.95} ${x + 8 * s},${base - h * 0.82}" fill="#2a1a16"/>
  </g>`;
}

function shopfront(x, w, { sign, signFont, num, goods, awning = ['#e0503c', '#f7e9d4'] }) {
  const top = 488, signY = 494, awnY = 532, openY = 554;
  let g = `${r(x + 6, signY, w - 12, 34, '#fffaf0', `stroke="${INK}" stroke-width="2" rx="4"`)}
    <text x="${x + w / 2 - 10}" y="${signY + 24}" text-anchor="middle" font-family="${signFont}" font-weight="700" font-size="${sign.length > 11 ? 15 : 18}" fill="#2a2a5a">${sign}</text>
    <circle cx="${x + w - 22}" cy="${signY + 17}" r="11" fill="#2a2a5a"/>
    <text x="${x + w - 22}" y="${signY + 22}" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="700" font-size="12" fill="#fff">${num}</text>`;
  // scalloped striped awning
  const n = Math.max(4, Math.round((w - 8) / 22));
  const sw = (w - 8) / n;
  for (let i = 0; i < n; i++) {
    const sx = x + 4 + i * sw;
    g += `<path d="M${sx},${awnY} h${sw} v14 a${sw / 2},${sw / 2.2} 0 0 1 -${sw},0 Z" fill="${awning[i % 2]}" stroke="${INK}" stroke-width="1.2"/>`;
  }
  g += r(x + 10, openY, w - 20, GROUND - openY, '#3d2a2c', `stroke="${INK}" stroke-width="2"`);
  g += goods(x + 10, openY, w - 20, GROUND - openY);
  g += r(x + 4, top - 4, 6, GROUND - top + 4, '#00000022') + r(x + w - 10, top - 4, 6, GROUND - top + 4, '#00000022');
  return g;
}

// Goods painters for the shop openings
const goods = {
  sweets: (x, y, w, h) => {
    let s = r(x + 6, y + h - 34, w - 12, 30, '#c98a4b', `stroke="${INK}" stroke-width="1.5"`);
    const cols = ['#f2b33d', '#f6e3b4', '#e8743c', '#f7d26a', '#e9c9a0'];
    for (let i = 0; i < Math.floor((w - 20) / 16); i++)
      for (let j = 0; j < 2; j++) s += `<circle cx="${x + 16 + i * 16}" cy="${y + h - 40 - j * 13}" r="6.5" fill="${cols[(i + j) % 5]}" stroke="${INK}" stroke-width="1"/>`;
    s += `<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="4" fill="#f2b33d"/>`;
    return s;
  },
  chai: (x, y, w, h) => {
    let s = r(x + 6, y + h - 32, w - 12, 28, '#7a4b2e', `stroke="${INK}" stroke-width="1.5"`);
    s += `<path d="M${x + w / 2 - 18},${y + h - 32} v-26 h36 v26 Z" fill="#9aa1a8" stroke="${INK}" stroke-width="1.5"/>
          <path class="steam" d="M${x + w / 2 - 6},${y + h - 62} q-6,-10 0,-20 q6,-10 0,-20" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7"/>`;
    for (let i = 0; i < 5; i++) s += `<path d="M${x + 14 + i * 12},${y + h - 44} h8 l-1.5,10 h-5 Z" fill="#c9653f" stroke="${INK}" stroke-width="1"/>`;
    return s;
  },
  puppets: (x, y, w, h) => {
    let s = '';
    const cols = ['#e0503c', '#2f5fb8', '#f2b33d', '#3c8c5a', '#c64889'];
    for (let i = 0; i < Math.floor((w - 16) / 22); i++) {
      const px = x + 16 + i * 22, len = 18 + (i % 3) * 10;
      s += `<line x1="${px}" y1="${y}" x2="${px}" y2="${y + len}" stroke="#d9c7a8" stroke-width="1"/>
            <g class="dangle" style="--d:${i * 0.3}s"><circle cx="${px}" cy="${y + len + 6}" r="5.5" fill="#f1d3b3" stroke="${INK}" stroke-width="1"/>
            <path d="M${px - 8},${y + len + 40} L${px - 4},${y + len + 12} h8 L${px + 8},${y + len + 40} Z" fill="${cols[i % 5]}" stroke="${INK}" stroke-width="1"/></g>`;
    }
    return s;
  },
  mishti: (x, y, w, h) => {
    let s = r(x + 6, y + h - 40, w - 12, 36, '#f5f0e6', `stroke="${INK}" stroke-width="1.5"`);
    for (let i = 0; i < Math.floor((w - 24) / 26); i++) {
      s += `<ellipse cx="${x + 22 + i * 26}" cy="${y + h - 46}" rx="11" ry="5" fill="#c9653f" stroke="${INK}" stroke-width="1"/>
            <circle cx="${x + 18 + i * 26}" cy="${y + h - 52}" r="5" fill="#fff8e6" stroke="${INK}" stroke-width=".8"/>
            <circle cx="${x + 27 + i * 26}" cy="${y + h - 52}" r="5" fill="#fff8e6" stroke="${INK}" stroke-width=".8"/>`;
    }
    return s;
  },
  books: (x, y, w, h) => {
    let s = '';
    const cols = ['#e0503c', '#2f5fb8', '#f2b33d', '#3c8c5a', '#7a4b9a', '#e8743c'];
    for (let row = 0; row < 3; row++) {
      s += r(x + 4, y + 22 + row * 22, w - 8, 3, '#8a5a3a');
      for (let i = 0; i < Math.floor((w - 12) / 9); i++) {
        const bh = 13 + ((i * 7 + row * 3) % 6);
        s += r(x + 7 + i * 9, y + 22 + row * 22 - bh, 7, bh, cols[(i + row * 2) % 6]);
      }
    }
    return s;
  },
  phuchka: (x, y, w, h) => {
    let s = `<path d="M${x + 10},${y + h - 30} h${w - 20} l-8,26 h-${w - 36} Z" fill="#c9a36b" stroke="${INK}" stroke-width="1.5"/>`;
    for (let i = 0; i < 14; i++) s += `<circle cx="${x + 22 + (i % 7) * ((w - 44) / 6)}" cy="${y + h - 36 - Math.floor(i / 7) * 10}" r="6" fill="#e3b46b" stroke="${INK}" stroke-width="1"/>`;
    s += `<rect x="${x + w / 2 - 12}" y="${y + 10}" width="24" height="34" rx="8" fill="#9ec9c4" stroke="${INK}" stroke-width="1.5"/>`;
    return s;
  },
};

// ---------- buildings ----------
function rajBuilding({ x, w, h, fill, trim, win, shop, chhatriAt, creepers = [] }) {
  const top = GROUND - h;
  let g = r(x, top, w, h, fill, `stroke="${INK}" stroke-width="2.5"`);
  // parapet with small pointed merlons
  const m = Math.floor(w / 18);
  for (let i = 0; i < m; i++) {
    const mx = x + (w - m * 18) / 2 + i * 18;
    g += `<path d="${pointedArch(mx + 2, top - 14, 14, 14)}" fill="${fill}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  g += r(x - 6, top, w + 12, 10, trim, `stroke="${INK}" stroke-width="2"`);
  // upper floors
  const floors = Math.floor((488 - top - 24) / 100);
  for (let f = 0; f < floors; f++) {
    const fy = top + 26 + f * 100;
    const count = Math.max(2, Math.floor(w / 56));
    const gap = w / count;
    for (let i = 0; i < count; i++) {
      const wx = x + gap * i + gap / 2 - 15;
      const isBay = f === floors - 1 && count >= 3 && i === Math.floor(count / 2);
      if (isBay) {
        // jharokha: projecting balcony with a little dome
        g += `<path d="M${wx - 12},${fy + 70} h54 l-6,12 h-42 Z" fill="${trim}" stroke="${INK}" stroke-width="1.5"/>
              ${r(wx - 8, fy + 8, 46, 62, trim, `stroke="${INK}" stroke-width="2"`)}
              <path d="${pointedArch(wx - 2, fy + 14, 34, 52)}" fill="${win}" stroke="${INK}" stroke-width="1.5"/>
              ${dome(wx + 15, fy + 8, 44, trim)}`;
      } else {
        g += `<path d="${pointedArch(wx - 3, fy + 4, 36, 66)}" fill="${trim}" stroke="${INK}" stroke-width="1.5"/>
              <path d="${pointedArch(wx + 2, fy + 10, 26, 56)}" fill="${win}" stroke="${INK}" stroke-width="1.5"/>
              <line x1="${wx + 15}" y1="${fy + 14}" x2="${wx + 15}" y2="${fy + 66}" stroke="${trim}" stroke-width="1.5"/>
              ${r(wx - 6, fy + 66, 42, 6, trim, `stroke="${INK}" stroke-width="1.5"`)}`;
      }
    }
    g += r(x, fy + 86, w, 5, trim, 'opacity=".55"');
  }
  g += shopfront(x, w, shop);
  if (chhatriAt != null) g += chhatri(x + chhatriAt, top - 2, 40, trim);
  for (const [cx, cy, s] of creepers) g += creeper(x + cx, top + cy, s);
  return `<g>${g}</g>`;
}

function calBuilding({ x, w, h, fill, trim, shutter, shop, tank = true, clothes = true, ac = true }) {
  const top = GROUND - h;
  let g = r(x, top, w, h, fill, `stroke="${INK}" stroke-width="2.5"`);
  // roof balustrade
  g += r(x - 4, top - 18, w + 8, 4, trim, `stroke="${INK}" stroke-width="1.2"`);
  for (let bx = x + 4; bx < x + w - 4; bx += 10) g += r(bx, top - 14, 5, 14, trim, `stroke="${INK}" stroke-width="1"`);
  g += r(x - 8, top, w + 16, 9, trim, `stroke="${INK}" stroke-width="2"`);
  if (tank) g += `<path d="M${x + w - 52},${top - 18} v-30 q0,-7 16,-7 q16,0 16,7 v30 Z" fill="#2b2b2b" stroke="${INK}" stroke-width="1.5"/>
                  <line x1="${x + w - 52}" y1="${top - 38}" x2="${x + w - 20}" y2="${top - 38}" stroke="#555"/>`;
  const floors = Math.floor((488 - top - 24) / 100);
  for (let f = 0; f < floors; f++) {
    const fy = top + 24 + f * 100;
    const count = Math.max(2, Math.floor(w / 58));
    const gap = w / count;
    for (let i = 0; i < count; i++) {
      const wx = x + gap * i + gap / 2 - 16;
      g += `<path d="${roundArch(wx - 3, fy, 38, 74)}" fill="${trim}" stroke="${INK}" stroke-width="1.5"/>
            <path d="M${wx + 1},${fy + 18} a15,15 0 0 1 30,0 Z" fill="#cfe3e6" stroke="${INK}" stroke-width="1"/>`;
      for (const sx of [wx + 1, wx + 16]) {
        g += r(sx, fy + 20, 15, 50, shutter, `stroke="${INK}" stroke-width="1.2"`);
        for (let l = fy + 25; l < fy + 68; l += 5) g += `<line x1="${sx + 2}" y1="${l}" x2="${sx + 13}" y2="${l}" stroke="${INK}" stroke-opacity=".35" stroke-width="1"/>`;
      }
    }
    // wrought iron balcony
    g += r(x + 6, fy + 70, w - 12, 5, '#2b2b2b');
    for (let bx = x + 10; bx < x + w - 8; bx += 7) g += `<line x1="${bx}" y1="${fy + 75}" x2="${bx}" y2="${fy + 92}" stroke="#2b2b2b" stroke-width="1.5"/>`;
    g += r(x + 6, fy + 90, w - 12, 4, '#2b2b2b');
    if (clothes && f === 0) {
      g += `<path d="M${x + 12},${fy + 60} Q${x + w / 2},${fy + 70} ${x + w - 12},${fy + 60}" stroke="#555" fill="none"/>`;
      const cc = ['#e0503c', '#f2b33d', '#2f5fb8', '#f7e9d4', '#c64889'];
      for (let i = 0; i < Math.floor((w - 40) / 26); i++) {
        const cx = x + 22 + i * 26, cy = fy + 63 + Math.sin(i) * 2;
        g += `<path class="flutter" d="M${cx},${cy} h16 v${18 + (i % 2) * 8} h-16 Z" fill="${cc[i % 5]}" stroke="${INK}" stroke-width=".8"/>`;
      }
    }
    if (ac && f === floors - 1) g += `${r(x + 10, fy + 34, 26, 18, '#e8e4dc', `stroke="${INK}" stroke-width="1.2" rx="2"`)}<circle cx="${x + 23}" cy="${fy + 43}" r="6" fill="none" stroke="#999"/>`;
  }
  g += shopfront(x, w, shop);
  return `<g>${g}</g>`;
}

// ---------- the two city gates ----------
function udaipurGate() {
  const x = 335, w = 270, h = 430, top = GROUND - h, cx = x + w / 2;
  const blue = '#2b45a6', cream = '#f6eddc';
  let g = '';
  // side towers
  for (const tx of [x - 10, x + w - 40]) {
    g += r(tx, top + 40, 50, h - 40, cream, `stroke="${INK}" stroke-width="2.5"`);
    g += chhatri(tx + 25, top + 40, 44, cream);
    for (let wy = top + 80; wy < GROUND - 160; wy += 80)
      g += `<path d="${pointedArch(tx + 13, wy, 24, 46)}" fill="${blue}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  // main body
  g += r(x + 40, top + 70, w - 80, h - 70, cream, `stroke="${INK}" stroke-width="2.5"`);
  for (let i = 0; i < 9; i++) g += `<path d="${pointedArch(x + 44 + i * 21, top + 56, 15, 14)}" fill="${cream}" stroke="${INK}" stroke-width="1.3"/>`;
  g += dome(cx, top + 70, 86, cream);
  g += r(x + 40, top + 70, w - 80, 8, blue);
  // blue ornament band like the stamp border
  for (let i = 0; i < 18; i++) g += `<circle cx="${x + 48 + i * 10.4}" cy="${top + 92}" r="2.6" fill="${blue}"/>`;
  // jharokha row
  for (let i = 0; i < 3; i++) {
    const jx = x + 66 + i * 50;
    g += `<path d="${pointedArch(jx, top + 108, 38, 60)}" fill="${blue}" stroke="${INK}" stroke-width="1.5"/>
          <path d="M${jx - 4},${top + 168} h46 l-5,8 h-36 Z" fill="${cream}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  // sign banner
  g += `<g class="gate-sign">${r(x + 30, top + 196, w - 60, 44, cream, `stroke="${blue}" stroke-width="3" rx="3"`)}
    ${r(x + 35, top + 201, w - 70, 34, 'none', `stroke="${blue}" stroke-width="1" stroke-dasharray="3 3"`)}
    <text x="${cx}" y="${top + 226}" text-anchor="middle" font-family="Bowlby One, sans-serif" font-size="19" fill="${blue}" letter-spacing="1">UDAIPUR</text>
    <text x="${cx}" y="${top + 239}" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="700" font-size="11" fill="${blue}">उदयपुर · City of Lakes</text></g>`;
  // the portal: Lake Pichola seen through the arch
  const ax = cx - 62, ay = top + 258, aw = 124, ah = GROUND - ay;
  g += `<defs><clipPath id="arch-u"><path d="${pointedArch(ax, ay, aw, ah)}"/></clipPath>
    <linearGradient id="lake-u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc59a"/><stop offset=".55" stop-color="#f7a28a"/><stop offset=".56" stop-color="#3f63b8"/><stop offset="1" stop-color="#22397f"/></linearGradient></defs>
    <g clip-path="url(#arch-u)" class="portal">
      ${r(ax, ay, aw, ah, 'url(#lake-u)')}
      <circle cx="${cx + 30}" cy="${ay + 70}" r="14" fill="#ffe2a8"/>
      <path d="M${ax},${ay + 120} l20,-20 l18,8 l26,-26 l30,22 l30,-12 v28 Z" fill="#c98a8a" opacity=".55"/>
      <g fill="#fff6ea">${r(ax + 14, ay + 98, 96, 24, '#fff6ea')}${r(ax + 24, ay + 86, 18, 12, '#fff6ea')}${r(ax + 70, ay + 82, 22, 16, '#fff6ea')}
        <circle cx="${ax + 33}" cy="${ay + 86}" r="7"/><circle cx="${ax + 81}" cy="${ay + 82}" r="9"/></g>
      ${[0, 1, 2, 3].map((i) => `<path class="ripple" style="--d:${i * 0.5}s" d="M${ax + 10 + i * 22},${ay + 140 + i * 9} h28" stroke="#9fb5ea" stroke-width="2" stroke-linecap="round"/>`).join('')}
      <path d="M${ax + 40},${ay + 160} q14,8 28,0 l-4,6 h-20 Z" fill="#7a4b2e"/>
    </g>
    <path d="${pointedArch(ax, ay, aw, ah)}" fill="none" stroke="${blue}" stroke-width="7"/>
    <path d="${pointedArch(ax - 7, ay - 8, aw + 14, ah + 8)}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  g += creeper(x - 6, top + 46, 1.1) + creeper(x + w + 2, top + 60, 1);
  return `<g id="gate-udaipur" class="gate" data-city="udaipur">${g}</g>`;
}

function kolkataGate() {
  const x = 1000, w = 270, h = 420, top = GROUND - h, cx = x + w / 2;
  const brick = '#b9503a', cream = '#f3e3c3', green = '#2f6b4f';
  let g = '';
  // clock tower
  g += r(cx - 30, top - 70, 60, 80, brick, `stroke="${INK}" stroke-width="2.5"`);
  g += `<circle cx="${cx}" cy="${top - 34}" r="21" fill="${cream}" stroke="${INK}" stroke-width="2"/>
    <line x1="${cx}" y1="${top - 34}" x2="${cx}" y2="${top - 48}" stroke="${INK}" stroke-width="2.5" class="clock-min"/>
    <line x1="${cx}" y1="${top - 34}" x2="${cx + 9}" y2="${top - 30}" stroke="${INK}" stroke-width="3"/>
    ${r(cx - 36, top - 76, 72, 8, cream, `stroke="${INK}" stroke-width="1.5"`)}
    ${dome(cx, top - 76, 50, cream)}`;
  // body
  g += r(x, top, w, h, brick, `stroke="${INK}" stroke-width="2.5"`);
  // brick texture
  for (let by = top + 12; by < GROUND - 160; by += 12)
    for (let bx = x + ((by / 12) % 2) * 9; bx < x + w - 10; bx += 18) g += r(bx + 2, by, 14, 1.4, '#9c3f2c', 'opacity=".55"');
  // pediment
  g += `<path d="M${x - 10},${top + 6} L${cx},${top - 30} L${x + w + 10},${top + 6} Z" fill="${cream}" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="${cx}" cy="${top - 6}" r="9" fill="${brick}" stroke="${INK}" stroke-width="1.5"/>`;
  g += r(x - 8, top + 6, w + 16, 10, cream, `stroke="${INK}" stroke-width="2"`);
  // pilasters
  for (let i = 0; i < 4; i++) {
    const px = x + 14 + i * ((w - 40) / 3);
    g += r(px, top + 16, 12, GROUND - top - 16, cream, `stroke="${INK}" stroke-width="1.5"`);
    g += r(px - 3, top + 16, 18, 8, cream, `stroke="${INK}" stroke-width="1.2"`);
  }
  // upper windows with green shutters
  for (let i = 0; i < 3; i++) {
    const wx = x + 38 + i * 77;
    g += `<path d="${roundArch(wx, top + 34, 44, 84)}" fill="${cream}" stroke="${INK}" stroke-width="1.5"/>
          ${r(wx + 4, top + 58, 17, 56, green, `stroke="${INK}" stroke-width="1"`)}${r(wx + 23, top + 58, 17, 56, green, `stroke="${INK}" stroke-width="1"`)}
          <path d="M${wx + 4},${top + 56} a18,18 0 0 1 36,0 Z" fill="#cfe3e6" stroke="${INK}" stroke-width="1"/>`;
  }
  g += r(x + 6, top + 124, w - 12, 5, '#2b2b2b');
  for (let bx = x + 10; bx < x + w - 8; bx += 7) g += `<line x1="${bx}" y1="${top + 129}" x2="${bx}" y2="${top + 146}" stroke="#2b2b2b" stroke-width="1.5"/>`;
  g += r(x + 6, top + 144, w - 12, 4, '#2b2b2b');
  // sign
  g += `<g class="gate-sign">${r(x + 28, top + 170, w - 56, 44, '#fff7df', `stroke="${INK}" stroke-width="2.5" rx="3"`)}
    ${r(x + 33, top + 175, w - 66, 34, 'none', `stroke="#c0392b" stroke-width="1" stroke-dasharray="3 3"`)}
    <text x="${cx}" y="${top + 199}" text-anchor="middle" font-family="Bowlby One, sans-serif" font-size="19" fill="#b9503a" letter-spacing="1">KOLKATA</text>
    <text x="${cx}" y="${top + 212}" text-anchor="middle" font-family="Baloo Da 2, sans-serif" font-weight="700" font-size="11" fill="#b9503a">কলকাতা · City of Joy</text></g>`;
  // portal: Howrah Bridge over the Hooghly, a yellow taxi crossing
  const ax = cx - 64, ay = top + 232, aw = 128, ah = GROUND - ay;
  let truss = '';
  for (let i = 0; i < 9; i++) truss += `<line x1="${ax + 4 + i * 15}" y1="${ay + 108}" x2="${ax + 12 + i * 15}" y2="${ay + 76 + Math.abs(4 - i) * 5}" stroke="#4a3b4a" stroke-width="1.6"/>`;
  g += `<defs><clipPath id="arch-k"><path d="${roundArch(ax, ay, aw, ah)}"/></clipPath>
    <linearGradient id="sky-k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb47a"/><stop offset=".6" stop-color="#f58b6b"/><stop offset=".61" stop-color="#8a6a7e"/><stop offset="1" stop-color="#4a4060"/></linearGradient></defs>
    <g clip-path="url(#arch-k)" class="portal">
      ${r(ax, ay, aw, ah, 'url(#sky-k)')}
      <circle cx="${ax + 34}" cy="${ay + 80}" r="13" fill="#ffe2a8"/>
      ${r(ax - 4, ay + 60, 10, 60, '#4a3b4a')}${r(ax + aw - 6, ay + 60, 10, 60, '#4a3b4a')}
      <path d="M${ax},${ay + 66} Q${cx},${ay + 100} ${ax + aw},${ay + 66}" stroke="#4a3b4a" stroke-width="3" fill="none"/>
      ${truss}${r(ax, ay + 108, aw, 6, '#4a3b4a')}
      <g class="portal-taxi"><rect x="${ax + 20}" y="${ay + 99}" width="22" height="9" rx="3" fill="#f5c518" stroke="${INK}" stroke-width="1"/></g>
      ${[0, 1, 2].map((i) => `<path class="ripple" style="--d:${i * 0.6}s" d="M${ax + 16 + i * 34},${ay + 140 + i * 10} h26" stroke="#b8a6c9" stroke-width="2" stroke-linecap="round"/>`).join('')}
      <path d="M${ax + 60},${ay + 156} h34 l-6,8 h-26 Z" fill="#f3e3c3" stroke="${INK}"/>
    </g>
    <path d="${roundArch(ax, ay, aw, ah)}" fill="none" stroke="${cream}" stroke-width="8"/>
    <path d="${roundArch(ax - 8, ay - 8, aw + 16, ah + 8)}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  g += pottedPlant(x + 20, GROUND, 0.9) + pottedPlant(x + w - 20, GROUND, 0.9);
  return `<g id="gate-kolkata" class="gate" data-city="kolkata">${g}</g>`;
}

// ---------- layers ----------
function skyLayer() {
  const clouds = [[180, 120, 1.1, 0], [620, 70, 0.8, -12], [1050, 140, 1.2, -25], [1420, 80, 0.9, -40]]
    .map(([x, y, s, d]) => `<g class="cloud" style="animation-delay:${d}s"><g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="0" rx="70" ry="22" fill="#fff6f0"/><circle cx="-25" cy="-12" r="24" fill="#fff6f0"/><circle cx="12" cy="-20" r="30" fill="#fff6f0"/><circle cx="42" cy="-6" r="20" fill="#fff6f0"/></g></g>`).join('');
  const kites = [[300, 150, '#e0503c', '#f2b33d', 0], [1250, 110, '#2f5fb8', '#f7e9d4', 1.2], [880, 60, '#3c8c5a', '#f2b33d', 2.1]]
    .map(([x, y, a, b, d]) => `<g class="kite" style="--d:${d}s;transform-origin:${x}px ${y}px">
      <path d="M${x},${y - 22} L${x + 17},${y} L${x},${y + 24} L${x - 17},${y} Z" fill="${a}" stroke="${INK}" stroke-width="1.5"/>
      <path d="M${x},${y - 22} L${x + 17},${y} L${x},${y} Z" fill="${b}"/>
      <path d="M${x},${y + 24} q8,14 -4,26 q-10,12 2,24" stroke="${INK}" stroke-width="1" fill="none"/>
      <path d="M${x},${y + 24} Q${x + 60},${y + 200} ${x + 120},${y + 520}" stroke="${INK}" stroke-opacity=".3" stroke-width=".8" fill="none"/></g>`).join('');
  const birds = [[700, 160], [740, 175], [770, 150], [1180, 200], [1210, 212]]
    .map(([x, y], i) => `<path class="bird" style="--d:${i * 0.17}s" d="M${x - 9},${y} q5,-6 9,0 q4,-6 9,0" stroke="${INK}" stroke-width="2" fill="none"/>`).join('');
  return svg(`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7c9c0"/><stop offset=".55" stop-color="#fbdcd0"/><stop offset="1" stop-color="#fde9dc"/></linearGradient>
      <radialGradient id="sun"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#ffd98a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>
    ${r(-200, -200, 2000, 1300, 'url(#sky)')}
    <circle cx="1300" cy="150" r="140" fill="url(#sun)"/><circle cx="1300" cy="150" r="46" fill="#fff0c2"/>
    ${clouds}${kites}${birds}`, 'layer-svg');
}

function skylineLayer() {
  const pale = '#e7aaa3', paler = '#efc1b9';
  // Aravalli hills and the City Palace on the left
  let left = `<path d="M-100,420 Q60,250 220,330 T520,300 T820,380 V640 H-100 Z" fill="${paler}"/>
    <path d="M-100,460 Q120,330 300,390 T700,380 V640 H-100 Z" fill="${pale}" opacity=".7"/>`;
  left += r(90, 300, 380, 140, pale) + r(130, 260, 120, 60, pale) + r(300, 270, 140, 50, pale);
  for (const [cx, w] of [[150, 30], [190, 40], [235, 30], [330, 36], [380, 44], [430, 30]]) left += dome(cx, cx < 260 ? 262 : 272, w, pale, 'none');
  for (let i = 0; i < 12; i++) left += `<path d="${pointedArch(104 + i * 30, 340, 14, 24)}" fill="${paler}"/>`;
  // Victoria Memorial and Howrah Bridge on the right
  let right = r(900, 330, 300, 120, pale) + r(990, 290, 120, 60, pale);
  right += dome(1050, 292, 110, pale, 'none') + dome(930, 332, 34, pale, 'none') + dome(1170, 332, 34, pale, 'none');
  right += `<path d="M1040,170 l10,-14 l10,14 Z" fill="${pale}"/>`;
  let truss = '';
  for (let i = 0; i < 26; i++) truss += `<line x1="${1240 + i * 15}" y1="370" x2="${1248 + i * 15}" y2="${300 + Math.abs(13 - i) * 4}" stroke="${pale}" stroke-width="3"/>`;
  right += `${r(1250, 250, 22, 130, pale)}${r(1560, 250, 22, 130, pale)}
    <path d="M1200,290 Q1420,370 1640,290" stroke="${pale}" stroke-width="6" fill="none"/>${truss}${r(1200, 368, 440, 10, pale)}`;
  return svg(`<g class="skyline">${left}${right}</g>`, 'layer-svg');
}

function buildingsLayer() {
  const B = [
    rajBuilding({ x: -20, w: 180, h: 360, fill: '#f0a59b', trim: '#fbe3d6', win: '#7b2f45', chhatriAt: 120, creepers: [[10, 30, 1.2]],
      shop: { sign: 'घेवर भंडार', signFont: 'Baloo 2, sans-serif', num: 11, goods: goods.sweets } }),
    rajBuilding({ x: 160, w: 175, h: 400, fill: '#de7f63', trim: '#f8dccb', win: '#5a2333', chhatriAt: 50, creepers: [[150, 60, 1]],
      shop: { sign: 'MEWAR CHAI', signFont: 'Bowlby One, sans-serif', num: 12, goods: goods.chai, awning: ['#2f5fb8', '#f7e9d4'] } }),
    udaipurGate(),
    rajBuilding({ x: 605, w: 165, h: 340, fill: '#f6b98f', trim: '#fff0e0', win: '#7b3b2a', creepers: [[140, 20, 1.1]],
      shop: { sign: 'कठपुतली घर', signFont: 'Baloo 2, sans-serif', num: 14, goods: goods.puppets, awning: ['#3c8c5a', '#f7e9d4'] } }),
    calBuilding({ x: 832, w: 168, h: 360, fill: '#f2c14e', trim: '#fff3d6', shutter: '#3f8f6a', clothes: true,
      shop: { sign: 'মিষ্টি ঘর', signFont: 'Baloo Da 2, sans-serif', num: 21, goods: goods.mishti } }),
    kolkataGate(),
    calBuilding({ x: 1270, w: 165, h: 390, fill: '#7fbfb0', trim: '#f2f4ea', shutter: '#2f6b4f', clothes: false,
      shop: { sign: 'BOI PARA', signFont: 'Bowlby One, sans-serif', num: 23, goods: goods.books, awning: ['#7a4b9a', '#f7e9d4'] } }),
    calBuilding({ x: 1435, w: 185, h: 350, fill: '#ef9b86', trim: '#fff0e6', shutter: '#3f8f6a', tank: false,
      shop: { sign: 'PHUCHKA', signFont: 'Bowlby One, sans-serif', num: 24, goods: goods.phuchka, awning: ['#f2b33d', '#e0503c'] } }),
  ];
  // the lane between the two halves, with a lantern string
  const lane = `${r(770, 380, 62, 260, '#e7aaa3', 'opacity=".5"')}
    <path d="M770,380 L800,640 M832,380 L802,640" stroke="#d98f86" stroke-width="1"/>`;
  const people = [
    person(70, GROUND + 2, { top: '#3c8c5a', sari: true, s: 0.95 }),
    person(300, GROUND + 2, { top: '#f7e9d4', bottom: '#7a4b2e', skin: '#8a5636' }),
    person(700, GROUND + 2, { top: '#c64889', sari: true, skin: '#b67a4c' }),
    person(905, GROUND + 2, { top: '#2f5fb8', bottom: '#f7e9d4', skin: '#9a6440' }),
    person(1360, GROUND + 2, { top: '#f2b33d', sari: true, skin: '#8a5636', s: 0.95 }),
    person(1540, GROUND + 2, { top: '#e0503c', bottom: '#2f3c6b' }),
  ].join('');
  return svg(`${lane}${B.join('')}${people}`, 'layer-svg');
}

function wiresLayer() {
  const flags = ['#e0503c', '#f2b33d', '#2f5fb8', '#3c8c5a', '#c64889', '#f7e9d4'];
  let bunting = '<path d="M560,300 Q800,360 1040,300" stroke="#555" fill="none" stroke-width="1.5"/>';
  for (let i = 0; i < 20; i++) {
    const t = (i + 0.5) / 20, x = 560 + 480 * t, y = 300 + 4 * 60 * t * (1 - t);
    bunting += `<path class="flag" style="--d:${i * 0.12}s;transform-origin:${x}px ${y}px" d="M${x - 9},${y} h18 l-9,18 Z" fill="${flags[i % 6]}" stroke="${INK}" stroke-width=".8"/>`;
  }
  let marigold = '<path d="M1290,260 Q1350,300 1420,262" stroke="#555" fill="none"/>';
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9, x = 1290 + 130 * t, y = 261 + 4 * 38 * t * (1 - t);
    marigold += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 22 + (i % 3) * 6}" stroke="#d98a1c" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 5"/>`;
  }
  const wires = [
    'M-20,215 Q400,265 820,225 T1640,230',
    'M-20,235 Q420,290 820,248 T1640,252',
    'M-20,255 Q380,300 820,272 T1640,276',
  ].map((d) => `<path d="${d}" stroke="#2b2b2b" stroke-width="1.6" fill="none"/>`).join('');
  const crows = [[300, 250], [338, 252], [1250, 254]].map(([x, y], i) =>
    `<g class="crow" style="--d:${i}s;transform-origin:${x}px ${y}px"><ellipse cx="${x}" cy="${y - 9}" rx="9" ry="7" fill="#2b2b2b"/><circle cx="${x + 7}" cy="${y - 15}" r="4.5" fill="#2b2b2b"/><path d="M${x + 11},${y - 15} l5,1 l-5,2 Z" fill="#555"/><path d="M${x - 8},${y - 7} l-8,4 l6,-8 Z" fill="#2b2b2b"/></g>`).join('');
  const pole = `${r(808, 200, 10, 440, '#6b5a4e', `stroke="${INK}" stroke-width="1.5"`)}${r(788, 212, 50, 6, '#6b5a4e')}${r(792, 232, 42, 5, '#6b5a4e')}
    <rect x="796" y="300" width="34" height="26" fill="#9aa1a8" stroke="${INK}" stroke-width="1.5"/>
    ${monkey(812, 236)}`;
  return svg(`${wires}${bunting}${marigold}${pole}${crows}`, 'layer-svg');
}

function monkey(x, y) {
  return `<g class="monkey" style="transform-origin:${x}px ${y}px">
    <path d="M${x + 4},${y + 30} q22,10 16,34 q-4,12 6,16" stroke="#8a5a3a" stroke-width="4" fill="none"/>
    <ellipse cx="${x}" cy="${y + 26}" rx="13" ry="17" fill="#9b6a44" stroke="${INK}" stroke-width="1.5"/>
    <circle cx="${x - 2}" cy="${y + 4}" r="11" fill="#9b6a44" stroke="${INK}" stroke-width="1.5"/>
    <ellipse cx="${x - 3}" cy="${y + 7}" rx="7" ry="6" fill="#e7b48a"/>
    <circle cx="${x - 6}" cy="${y + 4}" r="1.5" fill="${INK}"/><circle cx="${x}" cy="${y + 4}" r="1.5" fill="${INK}"/>
    <path d="M${x - 10},${y + 18} q-6,-14 -2,-20" stroke="#9b6a44" stroke-width="5" stroke-linecap="round" fill="none"/>
  </g>`;
}

function auto(x, y) {
  return `<g>
    <ellipse cx="${x + 70}" cy="${y + 78}" rx="78" ry="7" fill="#00000030"/>
    <path d="M${x + 10},${y + 16} Q${x + 18},${y - 6} ${x + 70},${y - 6} H${x + 140} V${y + 18} Z" fill="#1d1d1d" stroke="${INK}" stroke-width="2"/>
    <path d="M${x},${y + 70} V${y + 20} Q${x + 2},${y + 14} ${x + 14},${y + 14} H${x + 146} V${y + 70} Z" fill="#f2c230" stroke="${INK}" stroke-width="2.5"/>
    <path d="M${x + 4},${y + 20} q20,-2 22,22 v28 h-22 Z" fill="#cfe3e6" stroke="${INK}" stroke-width="1.5" opacity=".85"/>
    ${r(x + 44, y + 22, 54, 30, '#2a2a2a', 'rx="3"')}
    <circle cx="${x + 64}" cy="${y + 32}" r="7" fill="#a8693f"/><path d="M${x + 56},${y + 52} q8,-14 16,0" fill="#e0503c"/>
    <path d="M${x + 58},${y + 27} h12" stroke="#fff" stroke-width="3"/>
    ${r(x + 100, y + 30, 40, 20, '#1d6b4f', 'rx="3"')}
    <text x="${x + 120}" y="${y + 44}" text-anchor="middle" font-family="Baloo 2" font-size="10" font-weight="700" fill="#fff">VIRASAT</text>
    <circle cx="${x + 26}" cy="${y + 72}" r="13" fill="#1d1d1d"/><circle cx="${x + 26}" cy="${y + 72}" r="5" fill="#c0392b"/>
    <circle cx="${x + 120}" cy="${y + 72}" r="13" fill="#1d1d1d"/><circle cx="${x + 120}" cy="${y + 72}" r="5" fill="#c0392b"/>
    <circle cx="${x + 2}" cy="${y + 40}" r="5" fill="#fff6c4" stroke="${INK}"/>
  </g>`;
}

function taxi(x, y) {
  return `<g>
    <ellipse cx="${x + 75}" cy="${y + 56}" rx="80" ry="6" fill="#00000030"/>
    <path d="M${x + 30},${y + 18} Q${x + 40},${y - 6} ${x + 75},${y - 6} Q${x + 112},${y - 6} ${x + 122},${y + 18} Z" fill="#f5c518" stroke="${INK}" stroke-width="2"/>
    <path d="M${x + 42},${y + 16} Q${x + 48},${y} ${x + 74},${y} V${y + 16} Z M${x + 80},${y + 16} V${y} Q${x + 104},${y} ${x + 110},${y + 16} Z" fill="#cfe3e6"/>
    <path d="M${x},${y + 52} V${y + 28} Q${x + 2},${y + 16} ${x + 20},${y + 16} H${x + 132} Q${x + 150},${y + 18} ${x + 150},${y + 32} V${y + 52} Z" fill="#f5c518" stroke="${INK}" stroke-width="2.5"/>
    ${r(x + 60, y - 14, 30, 9, '#f7e9d4', `stroke="${INK}" stroke-width="1" rx="2"`)}
    <text x="${x + 75}" y="${y - 7}" text-anchor="middle" font-size="7" font-family="Baloo 2" font-weight="700" fill="${INK}">TAXI</text>
    ${r(x + 6, y + 34, 140, 3, '#2b2b2b', 'opacity=".5"')}
    <circle cx="${x + 32}" cy="${y + 54}" r="12" fill="#1d1d1d"/><circle cx="${x + 32}" cy="${y + 54}" r="5" fill="#ccc"/>
    <circle cx="${x + 118}" cy="${y + 54}" r="12" fill="#1d1d1d"/><circle cx="${x + 118}" cy="${y + 54}" r="5" fill="#ccc"/>
    <circle cx="${x + 2}" cy="${y + 34}" r="5" fill="#fff6c4" stroke="${INK}"/>
  </g>`;
}

function scooter(x, y) {
  return `<g>
    <circle cx="${x + 12}" cy="${y + 50}" r="12" fill="#1d1d1d"/><circle cx="${x + 78}" cy="${y + 50}" r="12" fill="#1d1d1d"/>
    <path d="M${x + 4},${y + 46} Q${x + 2},${y + 22} ${x + 30},${y + 22} H${x + 56} L${x + 70},${y + 4} h8 L${x + 66},${y + 30} Q${x + 90},${y + 32} ${x + 88},${y + 48} Z" fill="#3c8c5a" stroke="${INK}" stroke-width="2"/>
    ${r(x + 20, y + 16, 34, 8, '#2b2b2b', 'rx="3"')}
    <path d="M${x + 36},${y + 16} l-4,-30 h14 l6,30 Z" fill="#f7e9d4" stroke="${INK}" stroke-width="1.5"/>
    <circle cx="${x + 40}" cy="${y - 22}" r="9" fill="#e0503c" stroke="${INK}" stroke-width="1.5"/>
    <path d="M${x + 44},${y - 8} L${x + 70},${y + 4}" stroke="#a8693f" stroke-width="5" stroke-linecap="round"/>
  </g>`;
}

function roadLayer() {
  let pave = r(-100, GROUND, 1800, 72, '#d98a74');
  for (let y = GROUND + 12; y < GROUND + 72; y += 12)
    for (let x = -100 + ((y / 12) % 2) * 20; x < 1700; x += 40) pave += r(x, y, 38, 1.3, '#c4705b', 'opacity=".7"');
  let kerb = '';
  for (let x = -100; x < 1700; x += 40) kerb += r(x, GROUND + 72, 20, 12, '#2b2b2b') + r(x + 20, GROUND + 72, 20, 12, '#f2c230');
  let dash = '';
  for (let x = -60; x < 1700; x += 90) dash += r(x, 800, 50, 7, '#f7f2ea');
  return svg(`${pave}${kerb}
    ${r(-100, GROUND + 84, 1800, 200, '#8f8c95')}
    ${r(-100, GROUND + 84, 1800, 8, '#76737c')}${dash}
    <g class="veh veh-taxi">${taxi(0, 738)}</g>
    <g class="veh veh-auto">${auto(0, 790)}</g>
    <g class="veh veh-scooter">${scooter(0, 812)}</g>`, 'layer-svg');
}

function lamp(x) {
  return `<g>
    ${r(x - 4, 470, 8, 245, '#2b2b2b')}${r(x - 10, 706, 20, 10, '#2b2b2b')}
    <path d="M${x},476 q0,-18 -24,-20 M${x},476 q0,-18 24,-20" stroke="#2b2b2b" stroke-width="4" fill="none"/>
    <circle class="glow" cx="${x - 24}" cy="452" r="26" fill="url(#lampglow)"/><circle class="glow" cx="${x + 24}" cy="452" r="26" fill="url(#lampglow)"/>
    <circle cx="${x - 24}" cy="452" r="10" fill="#ffe36b" stroke="#2b2b2b" stroke-width="2"/><circle cx="${x + 24}" cy="452" r="10" fill="#ffe36b" stroke="#2b2b2b" stroke-width="2"/>
  </g>`;
}

function foregroundLayer() {
  return svg(`<defs><radialGradient id="lampglow"><stop offset="0" stop-color="#fff2a0" stop-opacity=".95"/><stop offset="1" stop-color="#ffe36b" stop-opacity="0"/></radialGradient></defs>
    ${lamp(40)}${lamp(1560)}
    ${pottedPlant(140, 722, 1.1)}${pottedPlant(1440, 722, 1.1)}`, 'layer-svg');
}

// paper grain that sits over everything, like the screen-printed look of the stamps
export const grain = `<svg class="grain" aria-hidden="true"><filter id="grainf"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .1  0 0 0 0 .08  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#grainf)"/></svg>`;

export function buildScene(world) {
  const layers = [
    ['sky', -520, skyLayer()],
    ['skyline', -300, skylineLayer()],
    ['buildings', -90, buildingsLayer()],
    ['wires', -50, wiresLayer()],
    ['road', 0, roadLayer()],
    ['fg', 70, foregroundLayer()],
  ];
  world.innerHTML = layers.map(([name, z, html]) =>
    `<div class="layer layer-${name}" style="--z:${z}">${html}</div>`).join('');
  return Object.fromEntries(layers.map(([name]) => [name, world.querySelector('.layer-' + name)]));
}
