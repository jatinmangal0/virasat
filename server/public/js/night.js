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

document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="css/night.css">');
const street = document.getElementById('street');
const btn = document.getElementById('nightBtn');
const cityBtn = document.getElementById('cityNight');
let built = false;

// The day/night switch (top bar, and the city page's corner): a pill of sky with a knob that slides across.
// Day: a sun on blue sky with layered clouds. Night: a cratered moon on dark sky with stars.
// Flat shapes only (no gradients or ids), so the same drawing can sit in two buttons at once.
const ring = (cx, fill, op) => [21, 29, 38].map((r) => `<circle cx="${cx}" cy="16" r="${r}" fill="${fill}" fill-opacity="${op}"/>`).join('');
const puffs = (list, fill) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
const spark = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-2.6L.6-.6 2.6 0 .6.6 0 2.6-.6.6-2.6 0-.6-.6Z"/>`;
const TOGGLE = `<span class="dn-track" aria-hidden="true">
    <svg class="dn-day" viewBox="0 0 64 32" preserveAspectRatio="xMidYMid slice">
      <rect width="64" height="32" fill="#3d8fe0"/>${ring(16, '#fff', 0.1)}
      ${puffs([[30, 34, 7], [38, 28, 7], [46, 24, 8], [55, 18, 8], [63, 12, 8], [64, 26, 10]], '#a9d4f5')}
      ${puffs([[26, 36, 6], [34, 32, 6], [42, 30, 7], [51, 27, 7], [59, 23, 7], [66, 22, 7], [44, 38, 8]], '#f4faff')}
    </svg>
    <svg class="dn-night" viewBox="0 0 64 32" preserveAspectRatio="xMidYMid slice">
      <rect width="64" height="32" fill="#1c2030"/>${ring(48, '#c9d2ff', 0.07)}
      <g fill="#fff">${spark(10, 9)}${spark(26, 13, 0.8)}${spark(19, 24, 0.9)}
        <circle cx="5" cy="17" r=".8"/><circle cx="15" cy="15" r=".6"/><circle cx="31" cy="6" r=".7"/><circle cx="12" cy="27" r=".7" fill-opacity=".7"/><circle cx="29" cy="23" r=".6"/><circle cx="35" cy="17" r=".5" fill-opacity=".7"/></g>
    </svg>
    <span class="dn-knob">
      <svg class="dn-sun" viewBox="0 0 24 24"><circle cx="12" cy="12.6" r="11.4" fill="#e9a21a"/><circle cx="12" cy="11.6" r="11" fill="#ffcf2e"/></svg>
      <svg class="dn-moon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11.4" fill="#cfd3dc"/>
        <circle cx="14.8" cy="6.4" r="2.1" fill="#a8b1c3"/><circle cx="8.6" cy="12.6" r="3.4" fill="#a8b1c3"/><circle cx="16.4" cy="16.2" r="2.6" fill="#a8b1c3"/></svg>
    </span>
  </span>`;
for (const b of [btn, cityBtn]) if (b) b.innerHTML = TOGGLE;

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

function setNight(on, save = true) {
  if (on && !built) build();
  street.classList.toggle('night', on);
  document.body.classList.toggle('is-night', on);
  for (const b of [btn, cityBtn]) b?.setAttribute('aria-pressed', on);
  nightSky(on);
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

whenSceneReady(() => {
  btn.hidden = false;
  btn.addEventListener('click', () => setNight(!street.classList.contains('night')));
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  if (saved === '1') setNight(true, false);
});
