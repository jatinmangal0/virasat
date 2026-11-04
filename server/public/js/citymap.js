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
// street: true when a street map (cityTilesHTML) lies underneath: it already shows the water and the grid,
// so the SVG only dims what lies outside the city and draws the marigold edge.
export function cityMapSVG(m, esc, { id = 'g', street = false } = {}) {
  const { W, H, toXY, ring, water } = m;
  const P = (list) => list.map(([lng, lat]) => toXY(lng, lat).map((v) => v.toFixed(1)).join(',')).join(' ');
  if (street) {
    return `${outsideMaskSVG(m)}
      ${ring.length > 2 ? `<polygon class="ex-land street" points="${P(ring)}"/><polygon class="ex-edge street" points="${P(ring)}" pathLength="1000"/>` : ''}`;
  }
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

// ---------- the street map under the outline ----------
// Raster tiles from OpenStreetMap's own tile server (free, no key, credit required), laid out in the same projection as the
// outline and the pins: each tile's corners go through toXY, so the map, the outline and the pins line up.
// Over one city, Web Mercator and this projection differ by far less than a pixel inside a tile.
const TILE = 256;
const tileX = (lng, z) => ((lng + 180) / 360) * 2 ** z;
const tileY = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z; };
const tileLng = (x, z) => (x / 2 ** z) * 360 - 180;
const tileLat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

export const MAP_CREDIT = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

export function cityTilesHTML(m) {
  const { W, H, fromXY, toXY } = m;
  const [lng0, lat0] = fromXY(0, 0), [lng1, lat1] = fromXY(W, H);
  // the zoom level whose tiles show closest to their own size (map text stays readable)
  const degPerPx = (lng1 - lng0) / W;
  const z = clamp(Math.round(Math.log2(360 / (TILE * degPerPx))), 3, 19);
  const x0 = Math.floor(tileX(lng0, z)), x1 = Math.floor(tileX(lng1, z));
  const y0 = Math.floor(tileY(lat0, z)), y1 = Math.floor(tileY(lat1, z));
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return '';   // never more than a screenful of tiles
  const out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const [l, t] = toXY(tileLng(x, z), tileLat(y, z));
    const [rr, b] = toXY(tileLng(x + 1, z), tileLat(y + 1, z));
    // a hair of overlap hides the seams between tiles
    out.push(`<img src="https://tile.openstreetmap.org/${z}/${x}/${y}.png" alt="" draggable="false" decoding="async"
      style="left:${l.toFixed(1)}px;top:${t.toFixed(1)}px;width:${(rr - l + 0.6).toFixed(1)}px;height:${(b - t + 0.6).toFixed(1)}px">`);
  }
  return out.join('');
}

// Everything outside the city's outline is dimmed, so the city stands out on the street map.
export function outsideMaskSVG(m) {
  const { W, H, toXY, ring } = m;
  if (ring.length < 3) return '';
  const d = ring.map(([lng, lat], i) => `${i ? 'L' : 'M'}${toXY(lng, lat).map((v) => v.toFixed(1)).join(' ')}`).join('') + 'Z';
  return `<path class="ex-outside" fill-rule="evenodd" d="M-4000 -4000H${W + 4000}V${H + 4000}H-4000Z${d}"/>`;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Put a fresh layer of tiles into box. The old layer stays underneath until the new one has loaded, so
// zooming never flashes blank. If the tiles cannot load at all (offline, blocked), onFail() is called once,
// and the page goes back to the drawn map.
let streetWorks = null;   // null: not known yet; true: a tile has loaded; false: tiles do not load here
export const streetMapOn = () => streetWorks !== false;
export function mountTiles(box, html, onFail) {
  if (!box) return;
  const layer = document.createElement('div');
  layer.className = 'tile-layer';
  layer.innerHTML = html;
  box.appendChild(layer);
  const imgs = [...layer.querySelectorAll('img')];
  // only layers drawn before this one go; a newer layer is left alone
  const dropOlder = () => { while (layer.isConnected && layer.previousElementSibling) layer.previousElementSibling.remove(); };
  let done = 0, ok = 0;
  const settle = () => {
    if (++done < imgs.length) return;
    dropOlder();
    if (!ok && streetWorks !== true) { streetWorks = false; box.innerHTML = ''; onFail?.(); }
  };
  imgs.forEach((img) => {
    img.addEventListener('load', () => { ok++; streetWorks = true; box.classList.add('loaded'); settle(); }, { once: true });
    img.addEventListener('error', settle, { once: true });
  });
  if (!imgs.length) settle();
  // a slow network must not keep stale tiles around for ever
  setTimeout(dropOlder, 2500);
}
