// The drawn city: its outline, lakes and river fitted into a box, for the Explore map and the map game.
// fitCity() works out where every [lng, lat] goes on screen (and back again, for a tap on the map);
// cityMapSVG() draws it. A view { z, x, y } zooms in by z around the point x, y (0 to 1 across the box).
const KM_PER_DEG = 111.32;

export function fitCity(c, W, H, view = { z: 1, x: 0.5, y: 0.5 }) {
  const water = c.water || {};
  const ring = c.outline || [];
  const wet = [...(water.areas || []).flatMap((a) => a.ring), ...(water.lines || []).flatMap((l) => l.line)];
  const all = [...ring, ...wet];
  if (all.length < 3 || !W || !H) return null;
  const lat0 = all.reduce((a, p) => a + p[1], 0) / all.length, k = Math.cos((lat0 * Math.PI) / 180);
  const xs = all.map((p) => p[0] * k), ys = all.map((p) => -p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), bw = Math.max(...xs) - minX, bh = Math.max(...ys) - minY;
  const pad = 0.08, sc0 = Math.min((W * (1 - 2 * pad)) / bw, (H * (1 - 2 * pad)) / bh);
  const ox0 = (W - bw * sc0) / 2 - minX * sc0, oy0 = (H - bh * sc0) / 2 - minY * sc0;
  // zoom: the point at (view.x, view.y) of the box stays put in the middle
  const z = view.z || 1, sc = sc0 * z;
  const ox = W / 2 - (view.x * W - ox0) * z, oy = H / 2 - (view.y * H - oy0) * z;
  const toXY = (lng, lat) => [lng * k * sc + ox, -lat * sc + oy];
  const fromXY = (x, y) => [(x - ox) / (k * sc), -(y - oy) / sc];
  // a place far outside the city's frame is not pinned; when zoomed in, neither is one outside the box
  const project = (lng, lat) => {
    const x = lng * k, y = -lat;
    if (x < minX - bw * 0.1 || x > minX + bw * 1.1 || y < minY - bh * 0.1 || y > minY + bh * 1.1) return null;
    const xy = toXY(lng, lat);
    if (z > 1 && (xy[0] < -20 || xy[0] > W + 20 || xy[1] < -20 || xy[1] > H + 20)) return null;
    return xy;
  };
  // how many km one pixel is, and the box's diagonal in km at zoom 1 (to judge "how close" in the map game)
  const kmPerPx = KM_PER_DEG / sc;
  const spanKm = Math.hypot(bw, bh) * KM_PER_DEG;
  return { W, H, z, toXY, fromXY, project, kmPerPx, spanKm, ring, water, base: { ox0, oy0, sc0 } };
}

// Distance in km between two [lng, lat] points (haversine).
export function kmBetween([lng1, lat1], [lng2, lat2]) {
  const r = Math.PI / 180, a = Math.sin(((lat2 - lat1) * r) / 2) ** 2
    + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// The map as SVG: a faint grid, the land, lakes, the river, the marigold edge and the water's names.
export function cityMapSVG(m, esc, { id = 'g' } = {}) {
  const { W, H, toXY, ring, water } = m;
  const P = (list) => list.map(([lng, lat]) => toXY(lng, lat).map((v) => v.toFixed(1)).join(',')).join(' ');
  const labels = [...(water.areas || []).filter((a) => a.ring.length > 40), ...(water.lines || [])].map((w) => {
    const pts = (w.ring || w.line).map(([lng, lat]) => toXY(lng, lat));
    const [x, y] = pts[Math.floor(pts.length / (w.ring ? 2.6 : 2))];
    return x < 0 || x > W || y < 0 || y > H ? '' : `<text class="water-name" x="${x.toFixed(0)}" y="${y.toFixed(0)}">${esc(w.name)}</text>`;
  });
  return `
    <defs><pattern id="${id}Grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#f6ead214" stroke-width="1"/></pattern></defs>
    <rect width="${W}" height="${H}" fill="url(#${id}Grid)"/>
    ${ring.length > 2 ? `<polygon class="ex-land" points="${P(ring)}"/>` : ''}
    ${(water.areas || []).map((a) => `<polygon class="lake" points="${P(a.ring)}"><title>${esc(a.name)}</title></polygon>`).join('')}
    ${(water.lines || []).map((l) => `<polyline class="river" points="${P(l.line)}" style="stroke-width:${Math.min(12 * m.z, 60).toFixed(0)}px"><title>${esc(l.name)}</title></polyline>`).join('')}
    ${ring.length > 2 ? `<polygon class="ex-edge" points="${P(ring)}" pathLength="1000"/>` : ''}
    ${labels.join('')}`;
}
