// The jute twine that ties the scroll, falls when the seal breaks, and becomes the timeline and
// the city map. Everything that draws twine goes through here, so it looks the same everywhere.
//
//   twineSVG(width)       markup for one piece of twine (stacked strokes: core, two strands, twist)
//   setTwine(g, points)   moves a piece of twine onto a list of [x, y] points
//   placeGarland(...)     threads marigolds and beads along a line (needs GARLAND_DEFS in the svg)
//   Rope                  a small physics rope (verlet) for twine that hangs and swings

// Smooth curve through the points (Catmull-Rom turned into cubic Béziers).
export function smoothPath(pts) {
  if (pts.length < 2) return '';
  const f = (n) => Math.round(n * 10) / 10;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

// Straight segments: cheaper, and smooth enough when the points are close together.
export function linePath(pts) {
  let d = '';
  for (let i = 0; i < pts.length; i++) d += `${i ? 'L' : 'M'}${Math.round(pts[i][0] * 10) / 10},${Math.round(pts[i][1] * 10) / 10}`;
  return d;
}

// Points every ~3px along the line (following the smooth curve when asked), so the twist can be drawn.
function densify(pts, smooth) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      if (!smooth) { out.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]); continue; }
      const t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}

// One piece of twine: a soft shadow, a dark core, two fibre strands that wind round each other,
// the grooves of the twist, a highlight and a few loose fibres.
export function twineSVG(w = 5, cls = '') {
  const s = (role, stroke, width, extra = '') => `<path data-r="${role}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  return `<g class="twine ${cls}" data-w="${w}">
    ${s('c', '#2a17084d', w + 3, 'transform="translate(1.5 3)"')}
    ${s('c', '#5e4122', w + 1)}
    ${s('a', '#b8915c', w * 0.62)}
    ${s('b', '#d9bd88', w * 0.5)}
    ${s('c', '#4a3218b3', w * 0.9, `stroke-dasharray="${w * 0.22} ${w * 1.03}"`)}
    ${s('h', '#f3e2bb', Math.max(0.8, w * 0.16), `stroke-dasharray="${w * 0.7} ${w * 0.55}"`)}
    ${s('f', '#e9d2a2', 0.7, `stroke-dasharray="1.2 ${w * 1.6}"`)}
  </g>`;
}

export function setTwine(g, pts, smooth = false) {
  if (pts.length < 2) return;
  const w = Number(g.dataset.w) || 5, dense = densify(pts, smooth), period = w * 2.5;
  // offset a copy of the line along its normal, waving, so two strands cross every half twist
  const strand = (amp, phase) => {
    let s = 0;
    return dense.map((p, i) => {
      const q = dense[Math.min(i + 1, dense.length - 1)], o = dense[Math.max(i - 1, 0)];
      if (i) s += Math.hypot(p[0] - dense[i - 1][0], p[1] - dense[i - 1][1]);
      const dx = q[0] - o[0], dy = q[1] - o[1], len = Math.hypot(dx, dy) || 1;
      const k = amp * Math.sin((s / period) * Math.PI * 2 + phase);
      return [p[0] - (dy / len) * k, p[1] + (dx / len) * k];
    });
  };
  const core = linePath(dense);
  const d = { c: core, a: linePath(strand(w * 0.2, 0)), b: linePath(strand(w * 0.2, Math.PI)), h: linePath(strand(w * 0.28, Math.PI * 0.5)), f: linePath(strand(w * 0.6, 1)) };
  for (const p of g.children) p.setAttribute('d', d[p.dataset.r]);
}

// Marigolds and brass beads threaded on the twine, like a toran over a doorway.
export const GARLAND_DEFS = `<defs>
  <g id="marigold">
    <circle r="7.5" fill="#e8730c"/>
    ${Array.from({ length: 10 }, (_, i) => `<circle cx="${(Math.cos(i * 0.628) * 5.6).toFixed(1)}" cy="${(Math.sin(i * 0.628) * 5.6).toFixed(1)}" r="3.4" fill="${i % 2 ? '#f59e1b' : '#f7b733'}"/>`).join('')}
    ${Array.from({ length: 7 }, (_, i) => `<circle cx="${(Math.cos(i * 0.9 + 0.3) * 2.8).toFixed(1)}" cy="${(Math.sin(i * 0.9 + 0.3) * 2.8).toFixed(1)}" r="2.2" fill="#fbc94c"/>`).join('')}
    <circle r="1.8" fill="#c2410c"/>
  </g>
  <g id="bead"><circle r="3.6" fill="#b98a2e"/><circle r="3.6" fill="none" stroke="#6b4a12" stroke-width=".8"/><circle cx="-1.1" cy="-1.2" r="1.2" fill="#f5dd8f"/></g>
  <g id="leaf"><path d="M0,0 C4,-3 10,-2 13,0 C10,2 4,3 0,0 Z" fill="#3f7d3a"/><path d="M1,0 L11,0" stroke="#2c5a28" stroke-width=".7"/></g>
</defs>`;

// Hang flowers along the line every `gap` pixels: marigold, bead, bead, marigold… with a pair of leaves now and then.
export function placeGarland(layer, pts, gap = 46, scale = 1) {
  const spots = [];
  let s = 0, next = gap * 0.5, n = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], d = Math.hypot(x1 - x0, y1 - y0);
    while (s + d >= next) {
      const t = (next - s) / (d || 1);
      spots.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.atan2(y1 - y0, x1 - x0) * 57.3, n++]);
      next += gap;
    }
    s += d;
  }
  const uses = layer.children;
  while (uses.length < spots.length) layer.insertAdjacentHTML('beforeend', '<use/>');
  for (let i = 0; i < uses.length; i++) {
    const u = uses[i], sp = spots[i];
    if (!sp) { u.style.display = 'none'; continue; }
    const kind = sp[3] % 6 === 0 ? 'leaf' : sp[3] % 2 ? 'bead' : 'marigold';
    if (u.dataset.k !== kind) { u.setAttribute('href', '#' + kind); u.dataset.k = kind; }
    u.style.display = '';
    u.setAttribute('transform', `translate(${sp[0].toFixed(1)} ${sp[1].toFixed(1)}) rotate(${(kind === 'leaf' ? sp[2] + 60 : sp[2]).toFixed(0)}) scale(${scale})`);
  }
}

// A rope of n points, `len` pixels long. pin(i, [x, y]) holds a point in place; step() moves it on.
export class Rope {
  constructor(points, len) {
    this.p = points.map(([x, y]) => ({ x, y, ox: x, oy: y }));
    this.seg = len / (points.length - 1);
    this.pins = new Map();
    this.gravity = 2600;
    this.damping = 0.985;
  }
  pin(i, xy) { this.pins.set(i, xy); }
  unpin(i) { this.pins.delete(i); }
  step(dt) {
    dt = Math.min(dt, 1 / 30);
    for (const q of this.p) {
      const vx = (q.x - q.ox) * this.damping, vy = (q.y - q.oy) * this.damping;
      q.ox = q.x; q.oy = q.y;
      q.x += vx; q.y += vy + this.gravity * dt * dt;
    }
    for (let k = 0; k < 30; k++) {
      for (let i = 0; i < this.p.length - 1; i++) {
        const a = this.p[i], b = this.p[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 0.001;
        const diff = (dist - this.seg) / dist / 2;
        const ax = this.pins.has(i), bx = this.pins.has(i + 1);
        if (!ax) { a.x += dx * diff * (bx ? 2 : 1); a.y += dy * diff * (bx ? 2 : 1); }
        if (!bx) { b.x -= dx * diff * (ax ? 2 : 1); b.y -= dy * diff * (ax ? 2 : 1); }
      }
      for (const [i, [x, y]] of this.pins) { this.p[i].x = x; this.p[i].y = y; }
    }
  }
  // How much the rope is still moving, in pixels per step.
  energy() { return this.p.reduce((m, q) => Math.max(m, Math.abs(q.x - q.ox) + Math.abs(q.y - q.oy)), 0); }
  points() { return this.p.map((q) => [q.x, q.y]); }
}
