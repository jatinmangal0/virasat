// Night mode for the street. The day/night switch in the top bar turns the sky to night and switches on
// the street lamps, the shop lights, a few windows upstairs and the headlamps of the auto, scooter
// and taxi. Each light source gets a soft pool of light that falls off around it.
//
// It works on top of the scene that scene.js drew, without changing it:
// - every daytime layer is dimmed with a CSS filter (.nt-dim)
// - the buildings get a second, undimmed copy that only shows through a soft mask around each
//   light, so shop goods and walls near a lamp come back in their real colours (.nt-lit)
// - warm glows and beams are drawn in extra SVGs inside each layer (.nt)
// - the sky itself, with the real stars and Moon for the place and time, is sky.js
// The extra layers are built the first time night is switched on, so the daytime page costs nothing.
import { nightSky } from './sky.js';

const NS = 'http://www.w3.org/2000/svg';
const KEY = 'virasat-night';
const WARM = '#ffd58a';

const street = document.getElementById('street');
const html = document.documentElement;
let built = false;
let night = html.classList.contains('dark'); // theme-early.js has already chosen, before the page was drawn

// ---------- the day/night switch ----------
// One drawing for every page (the top bar, the city page's corner, Explore's corner): a small pill of sky
// with a knob that slides across. Day: a warm sun with two paper-cut clouds. Night: a moon and a few stars.
// Flat cut-paper shapes in the site's colours and ink outline, like Gaju (no gradients and no ids, so the
// same drawing can sit in several buttons at once).
const INK = '#1d1714';
const star = (x, y, r) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, k = i % 2 ? r * 0.45 : r;
    pts.push(`${(x + k * Math.cos(a)).toFixed(2)},${(y + k * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}"/>`;
};
// a cut-paper cloud: flat bottom, three bumps; drawn twice, the darker copy a little lower, like a layer under it
const cloud = (x, y, s) => {
  const d = `M${x},${y}h${16 * s}a${3 * s},${3 * s} 0 0 0 -${3 * s},-${4.6 * s}a${4 * s},${4 * s} 0 0 0 -${6.4 * s},-${2.6 * s}a${3.4 * s},${3.4 * s} 0 0 0 -${6 * s},${2.4 * s}a${2.6 * s},${2.6 * s} 0 0 0 -${0.6 * s},${4.8 * s}z`;
  return `<path d="${d}" transform="translate(0 1.3)" fill="${INK}" fill-opacity=".18"/><path d="${d}" fill="#fffaf0" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>`;
};
const rays = (() => {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI / 12) * i, k = i % 2 ? 9.2 : 11.6;
    pts.push(`${(12 + k * Math.cos(a)).toFixed(2)},${(12 + k * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
})();
const SWITCH = `<span class="dn-track" aria-hidden="true">
    <svg class="dn-day" viewBox="0 0 64 32" preserveAspectRatio="xMidYMid slice">
      <rect width="64" height="32" fill="#a9dcee"/>
      <path d="M0,27 Q16,23 32,27 T64,26 V32 H0Z" fill="#8fcbe2"/>
      ${cloud(44, 13, 0.95)}${cloud(34, 25, 1.25)}
    </svg>
    <svg class="dn-night" viewBox="0 0 64 32" preserveAspectRatio="xMidYMid slice">
      <rect width="64" height="32" fill="#232a5c"/>
      <path d="M0,27 Q16,23 32,27 T64,26 V32 H0Z" fill="#1a2049"/>
      <g fill="#f7c744" stroke="${INK}" stroke-width=".6" stroke-linejoin="round">${star(12, 10, 4.2)}${star(27, 19, 3.2)}${star(19, 4.5, 2.2)}</g>
      <g fill="#f6ead2"><circle cx="6" cy="19" r=".9"/><circle cx="33" cy="8" r=".8"/><circle cx="17" cy="24" r=".7"/></g>
    </svg>
    <span class="dn-knob">
      <svg class="dn-sun" viewBox="0 0 24 24">
        <polygon points="${rays}" fill="#e8730c" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/>
        <circle cx="12" cy="12.8" r="7.6" fill="${INK}" fill-opacity=".22"/>
        <circle cx="12" cy="12" r="7.6" fill="#f7c744" stroke="${INK}" stroke-width=".9"/>
        <path d="M8.2,10.6a4.4,4.4 0 0 1 3.6,-3" fill="none" stroke="#fff3c4" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
      <svg class="dn-moon" viewBox="0 0 24 24">
        <circle cx="12" cy="12.9" r="10.6" fill="${INK}" fill-opacity=".3"/>
        <circle cx="12" cy="12" r="10.6" fill="#f6ead2" stroke="${INK}" stroke-width=".9"/>
        <g fill="#ddd0b6" stroke="${INK}" stroke-width=".6"><circle cx="15.2" cy="7.6" r="2"/><circle cx="8.6" cy="12.4" r="3"/><circle cx="15.6" cy="15.8" r="2.2"/></g>
      </svg>
    </span>
  </span>`;

const tip = () => (night ? 'Switch to light mode' : 'Switch to dark mode');
function paint(b) {
  b.setAttribute('aria-checked', String(night));
  b.title = tip();
}
// Any page part can have a switch: give it this drawing and the current state. Clicks are handled below,
// once for the whole page, so a switch drawn later (Explore draws its page each time it opens) just works.
export function mountSwitch(b) {
  if (!b) return;
  b.innerHTML = SWITCH;
  b.classList.add('dn-btn');
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-label', 'Dark mode');
  paint(b);
}

// a small seeded random so the stars and lit windows are the same on every visit
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const overlay = (base, cls, inner) => {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', base.getAttribute('viewBox'));
  s.setAttribute('preserveAspectRatio', base.getAttribute('preserveAspectRatio'));
  s.setAttribute('class', `layer-svg nt ${cls}`);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = inner;
  base.after(s);
  return s;
};
const box = (el) => { const b = el.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; };
const glow = (id, color, stops = [[0, 0.9], [0.35, 0.45], [1, 0]]) =>
  `<radialGradient id="${id}">${stops.map(([o, a]) => `<stop offset="${o}" stop-color="${color}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;

// copies that move with the scene (vehicles, swaying puppets) must run in step with the originals
function syncAnimations(from, to) {
  const a = from.getAnimations({ subtree: true }), b = to.getAnimations({ subtree: true });
  b.forEach((anim, i) => {
    const src = a[i];
    if (src && src.animationName === anim.animationName && src.startTime != null) anim.startTime = src.startTime;
  });
}

function skylineNight(skyline) {
  // a few lamps lit in the City Palace and fairy lights on the Howrah Bridge cable
  let lights = '';
  for (let i = 0; i < 12; i++) if (rand() < 0.55) lights += `<rect x="${108 + i * 30}" y="350" width="6" height="10" rx="2" fill="${WARM}" opacity=".8"/>`;
  for (let i = 0; i <= 22; i++) {
    const t = i / 22, x = 1200 + 440 * t, y = (1 - t) * (1 - t) * 290 + 2 * (1 - t) * t * 370 + t * t * 290;
    lights += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="#fff1c9"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="url(#nt-dot)"/>`;
  }
  for (let i = 0; i < 6; i++) lights += `<rect x="${920 + i * 48}" y="380" width="7" height="12" rx="2" fill="${WARM}" opacity=".7"/>`;
  overlay(skyline, 'nt-skyline', `<defs>${glow('nt-dot', '#ffe1a0', [[0, 0.7], [1, 0]])}</defs>${lights}`);
}

function buildingsNight(layer, base, lamps) {
  // the lit copy: day colours, seen only through the light mask
  const lit = base.cloneNode(true);
  lit.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  lit.setAttribute('class', 'layer-svg nt nt-lit');
  const wrap = document.createElementNS(NS, 'g');
  wrap.setAttribute('mask', 'url(#nt-litmask)');
  wrap.append(...lit.childNodes);
  lit.append(wrap);

  const shops = [...base.querySelectorAll('rect[fill="#3d2a2c"]')].map(box);
  const signs = [...base.querySelectorAll('rect[fill="#fffaf0"]')].map(box);
  const portals = [...base.querySelectorAll('.portal')].map(box);
  const windows = [...base.querySelectorAll('path[fill="#7b2f45"], path[fill="#5a2333"], path[fill="#7b3b2a"], path[fill="#cfe3e6"], path[fill="#2b45a6"], rect[fill="#4a3b4a"]')]
    .filter((el) => { const b = el.getBBox(); return b.height > 12 && b.width > 12 && b.y < 500; })
    .filter(() => rand() < 0.62);

  let mask = '', glows = '', spill = '';
  for (const s of shops) {
    mask += `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="#fff"/>
      <ellipse cx="${s.cx}" cy="${s.y + 4}" rx="${s.w * 0.75}" ry="80" fill="url(#nt-mfall)"/>`;
    glows += `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="url(#nt-shopwash)"/>
      <ellipse cx="${s.cx}" cy="${s.y + 10}" rx="${s.w * 0.7}" ry="60" fill="url(#nt-warm)" opacity=".55"/>`;
    // two bare bulbs hanging inside each shop
    for (const f of [0.3, 0.7]) {
      const bx = s.x + s.w * f;
      glows += `<line x1="${bx}" y1="${s.y}" x2="${bx}" y2="${s.y + 10}" stroke="#2b1c18" stroke-width="1"/>
        <circle cx="${bx}" cy="${s.y + 13}" r="16" fill="url(#nt-warm)"/><circle class="nt-bulb" cx="${bx}" cy="${s.y + 13}" r="3.2" fill="#fffbe8"/>`;
    }
  }
  for (const s of signs) mask += `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="#fff" opacity=".9"/>`;
  // The view through each gate is dusk at night too: lit only inside the arch's own shape (not its box),
  // tinted blue, with a string of lights across it (the Lake Palace, Howrah Bridge).
  for (const [k, el] of [...base.querySelectorAll('.portal')].entries()) {
    const p = portals[k], clip = /#([\w-]+)/.exec(el.getAttribute('clip-path') || '')?.[1];
    const d = clip && base.querySelector(`#${clip} path`)?.getAttribute('d');
    if (!d) continue;
    mask += `<path d="${d}" fill="#fff" opacity=".55"/>`;
    let lights = '';
    for (let i = 0; i < 7; i++) lights += `<circle class="nt-bulb" cx="${p.x + p.w * (0.14 + i * 0.12)}" cy="${p.y + p.h * 0.5 + (i % 2) * 2}" r="2.4" fill="#ffe9a8"/>`;
    glows += `<path d="${d}" fill="#16204a" opacity=".5"/>${lights}
      <ellipse cx="${p.cx}" cy="${p.y + p.h * 0.5}" rx="${p.w * 0.5}" ry="${p.h * 0.12}" fill="url(#nt-warm)" opacity=".35"/>`;
  }
  for (const el of windows) {
    const b = box(el), shape = el.cloneNode(false);
    shape.removeAttribute('id');
    shape.setAttribute('fill', 'url(#nt-pane)');
    shape.setAttribute('stroke', '#3a2420');
    glows += `<ellipse cx="${b.cx}" cy="${b.cy}" rx="${b.w * 1.4 + 12}" ry="${b.h * 0.9 + 10}" fill="url(#nt-warm)" opacity=".45"/>${shape.outerHTML}`;
    mask += `<ellipse cx="${b.cx}" cy="${b.cy}" rx="${b.w + 14}" ry="${b.h * 0.8}" fill="url(#nt-mfall)" opacity=".5"/>`;
  }
  // street lamps light up the walls behind them
  for (const l of lamps) {
    mask += `<ellipse cx="${l.x}" cy="${l.y + 40}" rx="140" ry="140" fill="url(#nt-mfall)" opacity=".45"/>`;
    spill += `<ellipse cx="${l.x}" cy="${l.y + 30}" rx="160" ry="140" fill="url(#nt-warm)" opacity=".22"/>`;
  }

  const defs = `<defs>
      <mask id="nt-litmask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="2000" height="1300">${mask}</mask>
      ${glow('nt-mfall', '#fff', [[0, 1], [0.45, 0.55], [1, 0]])}</defs>`;
  lit.insertAdjacentHTML('afterbegin', defs);
  base.after(lit);
  overlay(lit, 'nt-glow', `<defs>
      ${glow('nt-warm', '#ffc66b', [[0, 0.75], [0.4, 0.3], [1, 0]])}
      <linearGradient id="nt-shopwash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd98f" stop-opacity=".5"/><stop offset=".6" stop-color="#ffb35c" stop-opacity=".18"/><stop offset="1" stop-color="#ff9d3d" stop-opacity=".05"/></linearGradient>
      <linearGradient id="nt-pane" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6a6"/><stop offset=".7" stop-color="#ffb760"/><stop offset="1" stop-color="#e98a3a"/></linearGradient>
    </defs>${spill}${glows}`);
  requestAnimationFrame(() => syncAnimations(base, lit));
  return shops;
}

function wiresNight(wires) {
  // a string of festival lights along the bunting
  let bulbs = '';
  const cols = ['#ffe9a8', '#ffb3a1', '#bfe3ff', '#ffd27a', '#c9ffcf'];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, x = 560 + 480 * t, y = 300 + 4 * 60 * t * (1 - t) - 1;
    bulbs += `<circle cx="${x}" cy="${y}" r="7" fill="url(#nt-fairy)" class="nt-twinkle" style="--d:${(i % 5) * 0.4}s"/><circle cx="${x}" cy="${y}" r="1.8" fill="${cols[i % 5]}"/>`;
  }
  overlay(wires, 'nt-wires', `<defs>${glow('nt-fairy', '#ffe3a3', [[0, 0.8], [1, 0]])}</defs>${bulbs}`);
}

// headlamp and tail-lamp positions in each vehicle's own drawing (see roadLayer in scene.js)
const VEHICLES = {
  'veh-auto': { lamp: [144, 830], dir: 1, ground: 870, tail: [3, 846] },
  'veh-scooter': { lamp: [74, 823], dir: 1, ground: 874, tail: [6, 846] },
  'veh-taxi': { lamp: [2, 772], dir: -1, ground: 806, tail: [149, 774] },
};

function roadNight(road, lamps, shops) {
  let pools = '';
  for (const l of lamps) {
    pools += `<ellipse cx="${l.x}" cy="700" rx="190" ry="60" fill="url(#nt-pool)"/>
      <ellipse cx="${l.x}" cy="790" rx="260" ry="80" fill="url(#nt-pool)" opacity=".55"/>`;
  }
  for (const s of shops) {
    pools += `<path d="M${s.x},640 h${s.w} l${s.w * 0.35},72 h-${s.w * 1.7} Z" fill="url(#nt-spill)"/>`;
  }
  let veh = '';
  for (const [cls, v] of Object.entries(VEHICLES)) {
    const [lx, ly] = v.lamp, d = v.dir, gy = v.ground;
    const reach = 300;
    veh += `<g class="veh ${cls}"><g>
      <path d="M${lx},${ly - 4} L${lx + d * reach},${ly - 20} L${lx + d * (reach + 20)},${gy} L${lx + d * 30},${gy} L${lx},${ly + 4} Z" fill="url(#nt-beam${d > 0 ? 'r' : 'l'})"/>
      <ellipse cx="${lx + d * 150}" cy="${gy}" rx="150" ry="11" fill="url(#nt-pool)" opacity=".9"/>
      <circle cx="${lx}" cy="${ly}" r="20" fill="url(#nt-hl)"/><circle cx="${lx}" cy="${ly}" r="4.5" fill="#fffef6"/>
      <circle cx="${v.tail[0]}" cy="${v.tail[1]}" r="12" fill="url(#nt-tail)"/><circle cx="${v.tail[0]}" cy="${v.tail[1]}" r="2.6" fill="#ff5a4a"/>
    </g></g>`;
  }
  const beam = (id, x2) => `<linearGradient id="${id}" x1="${x2 > 0 ? 0 : 1}" y1="0" x2="${x2 > 0 ? 1 : 0}" y2="0">
      <stop offset="0" stop-color="#fff6d6" stop-opacity=".6"/><stop offset=".45" stop-color="#fff0c4" stop-opacity=".2"/><stop offset="1" stop-color="#fff0c4" stop-opacity="0"/></linearGradient>`;
  const ov = overlay(road, 'nt-road', `<defs>
      ${glow('nt-pool', '#ffcf7d', [[0, 0.42], [0.5, 0.16], [1, 0]])}
      ${glow('nt-hl', '#fff4cc', [[0, 0.95], [0.4, 0.35], [1, 0]])}
      ${glow('nt-tail', '#ff3b2e', [[0, 0.8], [1, 0]])}
      <linearGradient id="nt-spill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc370" stop-opacity=".4"/><stop offset="1" stop-color="#ffc370" stop-opacity="0"/></linearGradient>
      ${beam('nt-beamr', 1)}${beam('nt-beaml', -1)}
    </defs>${pools}${veh}`);
  requestAnimationFrame(() => {
    for (const cls of Object.keys(VEHICLES)) {
      const a = road.querySelector('.' + cls), b = ov.querySelector('.' + cls);
      if (a && b) syncAnimations(a, b);
    }
  });
}

function lampsNight(fg, lamps) {
  const heads = lamps.map((l, i) => `<g class="nt-lamp" style="--d:${0.15 + i * 0.35}s">
      <path d="M${l.x - 9},${l.y + 8} L${l.x + 9},${l.y + 8} L${l.x + 95},${l.post} L${l.x - 95},${l.post} Z" fill="url(#nt-cone)"/>
      <circle cx="${l.x}" cy="${l.y}" r="110" fill="url(#nt-halo)"/>
      <circle cx="${l.x}" cy="${l.y}" r="38" fill="url(#nt-core)"/>
      <circle cx="${l.x}" cy="${l.y}" r="10" fill="#fffbea" stroke="#6b5636" stroke-width="1.2"/>
      <circle cx="${l.x}" cy="${l.y}" r="6" fill="#ffffff"/></g>`).join('');
  overlay(fg, 'nt-fg', `<defs>
      ${glow('nt-halo', '#ffbf5e', [[0, 0.85], [0.2, 0.4], [0.5, 0.12], [1, 0]])}
      ${glow('nt-core', '#fff6d2', [[0, 1], [0.35, 0.85], [1, 0]])}
      <linearGradient id="nt-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3a0" stop-opacity=".28"/><stop offset="1" stop-color="#ffe3a0" stop-opacity="0"/></linearGradient>
    </defs>${heads}`);
}

function build() {
  const world = document.getElementById('world');
  const layer = (n) => world.querySelector(`.layer-${n} > svg`);
  const fg = layer('fg');
  // the lamp bulbs are the r=10 circles on the posts; read them from the scene so this follows any change there
  const lamps = [...fg.querySelectorAll('circle[r="10"]')].map((c) => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), post: 712 }));
  for (const n of ['sky', 'skyline', 'buildings', 'wires', 'road', 'fg']) layer(n)?.classList.add('nt-dim', `nt-dim-${n}`);
  skylineNight(layer('skyline'));
  const shops = buildingsNight(world.querySelector('.layer-buildings'), layer('buildings'), lamps);
  wiresNight(layer('wires'));
  roadNight(layer('road'), lamps, shops);
  lampsNight(fg, lamps);
  built = true;
}

// Dark or light for the whole site. The choice is saved, and every open tab and page follows it.
function setNight(on, { save = true, instant = false } = {}) {
  night = on;
  html.classList.toggle('dark', on);
  document.body.classList.toggle('is-night', on);
  document.querySelectorAll('.dn-btn').forEach(paint);
  nightSky(on);
  // the street's own lamps and lights need its drawing, which may still be on its way
  whenSceneReady(() => {
    if (night && !built) build();
    // on page load go straight to the right look, without the fade
    if (instant) street.classList.add('nt-instant');
    street.classList.toggle('night', night);
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => street.classList.remove('nt-instant')));
  });
  if (save) try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
}

function whenSceneReady(fn) {
  const world = document.getElementById('world');
  if (world.querySelector('.layer-fg > svg')) return fn();
  const mo = new MutationObserver(() => {
    if (world.querySelector('.layer-fg > svg')) { mo.disconnect(); fn(); }
  });
  mo.observe(world, { childList: true });
}

mountSwitch(document.getElementById('nightBtn'));
mountSwitch(document.getElementById('cityNight'));
document.addEventListener('click', (e) => { if (e.target.closest?.('.dn-btn')) setNight(!night); });
if (night) setNight(true, { save: false, instant: true });
// another tab or page switched: follow it
addEventListener('storage', (e) => { if (e.key === KEY && e.newValue) setNight(e.newValue === '1', { save: false }); });
// until the visitor chooses, the site follows the device's own setting, also when that changes
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    if (saved === null) setNight(e.matches, { save: false });
  });
} catch {}
