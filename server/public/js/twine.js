// The jute twine that ties the scroll, falls when the seal breaks, and becomes the timeline and
// the city map. Everything that draws twine goes through here, so it looks the same everywhere.
//
//   twineSVG(width)       markup for one piece of twine (several stacked strokes make the twist)
//   setTwine(g, points)   moves a piece of twine onto a list of [x, y] points
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

// One piece of twine: a soft shadow, the fibre body, a darker twist and a light twist on top.
export function twineSVG(w = 5, cls = '') {
  const s = (stroke, width, extra = '') => `<path fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  return `<g class="twine ${cls}" style="--tw:${w}">
    ${s('#2a17084d', w + 2.5, 'transform="translate(1.5 2.5)"')}
    ${s('#9c7646', w)}
    ${s('#6f4f2a', w * 0.62, `stroke-dasharray="${w * 0.55} ${w * 0.75}"`)}
    ${s('#dcc08f', w * 0.3, `stroke-dasharray="${w * 0.45} ${w * 0.85}" stroke-dashoffset="${w * 0.6}"`)}
  </g>`;
}

export function setTwine(g, pts, smooth = false) {
  const d = smooth ? smoothPath(pts) : linePath(pts);
  for (const p of g.children) p.setAttribute('d', d);
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
