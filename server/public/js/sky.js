// The night sky for night mode (night.js turns it on). It is the real sky over the place being viewed,
// right now: the bright stars where they actually are (Orion, the Plough, Cassiopeia...), thousands of faint
// ones and the Milky Way along its true path. On the city and Explore pages the Moon is there too, when it
// is up, in its real phase, place and tilt (sky-astro.js), drawn from NASA's map of its surface.
// Udaipur and Kolkata pages use that city; the street uses India, or roughly where the visitor is if their
// clock is set to another country. No location is asked for; only the Moon's map is fetched.
//
// The view looks towards the Moon when it is up (otherwise towards the south), with the horizon just behind
// the rooftops. Stars twinkle more near the horizon, as they do through thicker air, and a bright Moon
// washes out the faint stars around it.
//
// Cost: a still layer (sky, Milky Way, faint stars) drawn once a minute, and a light layer of bright
// twinkling stars, redrawn at 20-30 frames a second only while night mode is on and that sky is on screen.
// With "reduce motion" set, nothing moves: the sky is drawn once.
import { moon as moonAt, starProjector, nextMoonCrossing, galacticToEquatorial, deg } from './sky-astro.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => matchMedia('(max-width: 820px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

// ---------- where ----------
const PLACES = {
  udaipur: { lat: 24.5854, lng: 73.7125, name: 'Udaipur', tz: 'Asia/Kolkata' },
  kolkata: { lat: 22.5726, lng: 88.3639, name: 'Kolkata', tz: 'Asia/Kolkata' },
};
function homePlace() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
  if (!tz || /^Asia\/(Kolkata|Calcutta)$/.test(tz)) return { lat: 23.26, lng: 77.41, name: 'India', tz: 'Asia/Kolkata' };
  // elsewhere: the clock's offset gives the longitude well enough; the time-zone's region gives a latitude
  const lng = clamp(-new Date().getTimezoneOffset() / 4, -180, 180);
  const lat = /^Australia|^Pacific\/Auckland/.test(tz) ? -34 : /^America\/(Sao_Paulo|Argentina|Santiago|Lima|Bogota)/.test(tz) ? -15
    : /^Africa/.test(tz) ? 5 : /^Europe/.test(tz) ? 50 : /^America/.test(tz) ? 38 : 25;
  return { lat, lng, name: '', tz };
}
const routeKey = () => location.pathname.split('/')[1] || '';
export function placeFor(path = location.pathname) {
  return PLACES[path.split('/')[1]?.toLowerCase()] || homePlace();
}

// ---------- the stars ----------
// The brightest stars and the ones that draw the well-known shapes: RA (hours), Dec (degrees), magnitude, colour (B-V)
const CATALOG = `6.752 -16.716 -1.46 0|6.399 -52.696 -.74 .15|14.261 19.182 -.05 1.23|18.616 38.784 .03 0|5.278 45.998 .08 .8|
5.242 -8.202 .13 -.03|7.655 5.225 .34 .42|1.629 -57.237 .46 -.16|5.919 7.407 .5 1.85|14.064 -60.373 .61 -.23|19.846 8.868 .76 .22|
12.443 -63.099 .76 -.24|4.599 16.509 .86 1.54|16.49 -26.432 .96 1.83|13.42 -11.161 .97 -.23|7.755 28.026 1.14 1|
22.961 -29.622 1.16 .09|20.69 45.28 1.25 .09|12.795 -59.689 1.25 -.23|10.14 11.967 1.35 -.11|6.977 -28.972 1.5 -.21|
7.577 31.888 1.58 .03|17.56 -37.104 1.62 -.22|12.519 -57.113 1.63 1.6|5.419 6.35 1.64 -.22|5.438 28.608 1.65 -.13|
9.22 -69.717 1.67 .07|5.604 -1.202 1.69 -.18|22.137 -46.961 1.73 -.13|5.679 -1.943 1.74 -.21|12.9 55.96 1.77 -.02|
11.062 61.751 1.79 1.07|3.405 49.861 1.79 .48|7.14 -26.393 1.83 .68|18.403 -34.385 1.85 -.03|13.792 49.313 1.86 -.19|
17.622 -42.998 1.86 .4|8.375 -59.51 1.86 1.28|5.992 44.948 1.9 .08|16.811 -69.028 1.91 1.44|6.629 16.399 1.93 0|
20.427 -56.735 1.94 -.2|2.53 89.264 1.98 .6|6.378 -17.956 1.98 -.24|9.46 -8.659 1.98 1.44|2.12 23.462 2 1.15|
.727 -17.987 2.04 1.02|18.921 -26.297 2.05 -.13|14.111 -36.37 2.06 1.01|.14 29.091 2.06 -.11|1.163 35.621 2.06 1.58|
5.796 -9.67 2.07 -.17|14.845 74.156 2.08 1.47|17.582 12.56 2.08 .15|3.136 40.956 2.09 -.05|2.065 42.33 2.1 1.37|
11.818 14.572 2.13 .09|.675 56.537 2.24 1.17|.153 59.15 2.28 .34|.945 60.717 2.15 -.15|1.43 60.235 2.66 .13|1.907 63.67 3.35 -.15|
11.031 56.382 2.37 -.02|11.897 53.695 2.44 0|12.257 57.033 3.31 .08|13.399 54.925 2.23 .02|5.533 -.299 2.23 -.22|
20.37 40.257 2.23 .67|20.77 33.97 2.48 1.03|19.512 27.96 3.08 1.13|19.75 45.131 2.87 -.03|23.079 15.205 2.49 -.04|
23.063 28.083 2.42 1.67|.22 15.184 2.83 -.23|21.736 9.875 2.38 1.52|16.006 -22.622 2.29 -.12|16.091 -19.806 2.62 -.07|
17.513 -37.296 2.7 -.22|16.836 -34.293 2.29 1.15|16.598 -28.216 2.82 -.25|16.353 -25.593 2.89 .13|18.35 -29.828 2.7 1.38|
18.466 -25.421 2.81 1.02|19.044 -29.88 2.6 .08|18.761 -26.991 3.17 -.11|19.116 -27.671 3.32 1.19|18.097 -30.424 2.98 1|
10.333 19.842 2.08 1.15|11.235 20.524 2.56 .12|11.237 15.43 3.33 0|9.764 23.774 2.98 .81|10.278 23.417 3.44 .31|
10.122 16.763 3.52 -.03|6.732 25.131 3.06 1.4|6.383 22.514 2.87 1.6|7.335 21.982 3.53 .34|3.791 24.105 2.87 -.09|
3.819 24.053 3.62 -.07|3.749 24.113 3.7 -.11|3.763 24.368 3.87 -.07|3.772 23.948 4.18 -.06|3.754 24.467 4.3 -.11|
4.478 15.871 3.4 .18|4.33 15.628 3.65 .99|4.382 17.543 3.76 .98|4.477 19.18 3.53 1.01|5.627 21.143 3 -.19|
5.585 9.934 3.39 -.18|5.59 -5.91 2.77 -.24|7.402 -29.303 2.45 -.08|4.95 33.166 2.69 1.53|5.995 37.213 2.62 -.08|
3.715 47.788 3 -.13|3.964 40.01 2.9 -.18|1.911 20.808 2.64 .13|3.038 4.09 2.54 1.64|19.771 10.613 2.72 1.52|
18.835 33.363 3.52 0|18.982 32.69 3.25 -.05|14.75 27.074 2.37 .97|15.578 26.715 2.23 -.02|12.694 -1.449 2.74 .36|
12.263 -17.542 2.58 -.11|12.573 -23.397 2.65 .89|12.498 -16.515 2.94 -.05|14.66 -60.834 -.27 .71|17.173 -15.725 2.43 .06|
17.943 51.489 2.24 1.52|21.31 62.585 2.45 .22|15.345 71.834 3 .05|.438 -42.306 2.4 1.09|21.784 -16.127 2.85 .29|
21.526 -5.571 2.87 .83|22.096 -.32 2.95 .98`;

// colour of a star from its B-V index: blue-white, white, cream, yellow, orange
const COLOURS = ['#b9cdff', '#e3ebff', '#fff7ea', '#ffe8c2', '#ffd29a', '#ffb879'];
const colourOf = (bv) => bv < -0.05 ? 0 : bv < 0.25 ? 1 : bv < 0.55 ? 2 : bv < 1 ? 3 : bv < 1.45 ? 4 : 5;

let seed = 20251104;
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(TAU * rand());

let STARS = null, MILKY = null;
function makeStars() {
  const named = CATALOG.replace(/\s/g, '').split('|').map((row) => {
    const [ra, dec, m, bv] = row.split(' ').map(Number);
    return { ra: ra * 15 * deg, dec: dec * deg, m, c: colourOf(bv) };
  });
  // the faint ones: scattered over the whole sky, thicker along the Milky Way
  const faint = [], n = small() ? 3600 : 6500;
  for (let i = 0; i < n; i++) {
    let m; do { m = 6.5 + Math.log(rand() + 1e-9) / 1.05; } while (m < 3.4);
    let ra, dec;
    if (rand() < 0.4) ({ ra, dec } = galacticToEquatorial(rand() * TAU, gauss() * 9 * deg));
    else { ra = rand() * TAU; dec = Math.asin(2 * rand() - 1); }
    const r = rand();
    faint.push({ ra, dec, m, c: r < 0.18 ? 0 : r < 0.55 ? 1 : r < 0.78 ? 2 : r < 0.92 ? 3 : 4 });
  }
  STARS = named.concat(faint);
  // the Milky Way: soft clouds along the galactic plane, brightest towards its centre in Sagittarius
  MILKY = [];
  for (let i = 0; i < (small() ? 260 : 420); i++) {
    const l = rand() * TAU, b = gauss() * 5.5 * deg, fromCentre = Math.min(l, TAU - l);
    const p = galacticToEquatorial(l, b);
    MILKY.push({ ...p, w: (0.35 + 0.9 * Math.exp(-(fromCentre ** 2) / (2 * 0.9 ** 2))) * (0.6 + rand() * 0.6), r: (3 + rand() * 7) * deg });
  }
}

// soft round sprites, one per colour, so a frame is only a few hundred small image draws
let SPRITES = null, BLOB = null;
function makeSprites() {
  SPRITES = COLOURS.map((c) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.07, '#ffffff'); gr.addColorStop(0.14, c);
    gr.addColorStop(0.3, c + '55'); gr.addColorStop(0.6, c + '12'); gr.addColorStop(1, c + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return cv;
  });
  BLOB = document.createElement('canvas'); BLOB.width = BLOB.height = 64;
  const g = BLOB.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#aab4e6ff'); gr.addColorStop(0.5, '#8d97cc66'); gr.addColorStop(1, '#8d97cc00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
}

// ---------- the Moon's face ----------
// The real surface: NASA's Lunar Reconnaissance Orbiter map of the Moon (public domain, NASA Scientific
// Visualization Studio, "CGI Moon Kit"), turned grey and made small (assets/moon-map.webp, 60 KB). It is
// only fetched the first time a Moon is drawn.
let MAP = null, mapLoading = null;
function loadMap() {
  mapLoading ||= new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, a = new Float32Array(c.width * c.height);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4] / 255;
      MAP = { w: c.width, h: c.height, a };
      resolve();
    };
    im.onerror = () => resolve();
    im.src = 'assets/moon-map.webp';
  });
  return mapLoading;
}
// brightness of the surface at selenographic latitude/longitude (radians), smoothly between map pixels
function albedo(lat, lon) {
  const { w, h, a } = MAP;
  const fx = ((lon / TAU + 0.5) * w - 0.5 + w) % w, fy = clamp((0.5 - lat / Math.PI) * h - 0.5, 0, h - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = (x0 + 1) % w, y1 = Math.min(y0 + 1, h - 1), tx = fx - x0, ty = fy - y0;
  const top = a[y0 * w + x0] * (1 - tx) + a[y0 * w + x1] * tx, bot = a[y1 * w + x0] * (1 - tx) + a[y1 * w + x1] * tx;
  return top * (1 - ty) + bot * ty;
}

// Paint the Moon into `cv`, D CSS pixels across, as it really looks: its true face turned the way it sits in
// the sky, lit from the Sun's side with a soft terminator; the unlit part is left see-through (the sky shows),
// with only a trace of earthshine on a thin crescent.
function paintMoon(cv, D, dpr, m, alt) {
  const N = Math.max(8, Math.round(D * dpr)), R = N / 2;
  cv.width = cv.height = N; cv.style.width = cv.style.height = D + 'px';
  const g = cv.getContext('2d'), img = g.createImageData(N, N), px = img.data;
  const i = m.phaseAngle, ux = -Math.sin(m.limb), uy = -Math.cos(m.limb);
  const sx = Math.sin(i) * ux, sy = Math.sin(i) * uy, sz = Math.cos(i);
  const cn = Math.cos(m.north), sn = Math.sin(m.north);
  // low in the sky the Moon turns golden, as its light comes through more air
  const warm = smooth(20, 2, alt / deg);
  const lr = 255, lg = 250 - 28 * warm, lb = 238 - 85 * warm;
  const shine = 0.07 * smooth(0.35, 0.05, m.fraction); // earthshine, only on a thin crescent
  for (let py = 0; py < N; py++) {
    for (let qx = 0; qx < N; qx++) {
      const x = (qx + 0.5 - R) / (R - 0.5), y = (py + 0.5 - R) / (R - 0.5), r2 = x * x + y * y;
      const k = (py * N + qx) * 4;
      if (r2 >= 1.04) { px[k + 3] = 0; continue; }
      const z = Math.sqrt(Math.max(0, 1 - r2));
      // the point on the Moon's own globe: turn the screen point back to the Moon's north-up frame
      const u = x * cn - y * sn, v = x * sn + y * cn;
      const a = albedo(Math.asin(clamp(-v, -1, 1)), Math.atan2(u, z));
      const mu0 = x * sx + y * sy + z * sz, mu = Math.max(z, 0.02);
      // Lommel-Seeliger: the Moon looks flat-lit (not like a shaded ball), darkening only near the terminator
      const ls = mu0 > 0 ? (2 * mu0) / (mu0 + mu) : 0;
      const lit = smooth(-0.015, 0.045, mu0) * Math.min(1, 0.15 + 0.85 * ls);
      // to the eye the dark seas are mid-grey, not black: soften the map's contrast
      const tone = Math.min(1, (0.42 + 0.66 * a) * lit);
      const alpha = clamp(lit * 1.4 + shine * a, 0, 1) * clamp((1 - Math.sqrt(r2)) * R + 0.5, 0, 1);
      const bright = alpha > 0 ? (tone + shine * a * 0.6) / alpha : 0;
      px[k] = lr * bright; px[k + 1] = lg * bright; px[k + 2] = lb * bright;
      px[k + 3] = 255 * alpha;
    }
  }
  g.putImageData(img, 0, 0);
}

// ---------- one sky ----------
const skies = new Set();
let raf = 0, lastDraw = 0;

class NightSky {
  // host: the element the sky fills; opts.horizon(H) and opts.top(H): the horizon line and the
  // highest the Moon may sit, in CSS pixels from the sky's top; opts.when(): whether it should show at all
  constructor(el, opts) {
    this.el = el; this.opts = opts; this.layoutAt = 0; this.live = []; this.meteor = null; this.meteorAt = performance.now() + 6000 + Math.random() * 12000;
    el.classList.add('night-sky');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<canvas class="ns-still"></canvas><canvas class="ns-live"></canvas>';
    if (opts.moon !== false) el.insertAdjacentHTML('beforeend', '<div class="ns-moon" hidden><canvas></canvas></div>');
    this.still = el.querySelector('.ns-still'); this.liveCv = el.querySelector('.ns-live');
    this.moonEl = el.querySelector('.ns-moon'); this.moonCv = this.moonEl?.querySelector('canvas');
    new ResizeObserver(() => { this.layoutAt = 0; kick(); }).observe(el);
    skies.add(this);
  }

  shown() {
    return document.body.classList.contains('is-night') && !document.hidden && this.el.getClientRects().length > 0
      && this.el.clientWidth > 0 && (this.opts.when?.() ?? true);
  }

  layout() {
    const W = this.el.clientWidth, H = this.el.clientHeight;
    if (!W || !H) return;
    if (!STARS) makeStars();
    if (!SPRITES) makeSprites();
    const dpr = Math.min(devicePixelRatio || 1, small() ? 1.5 : 2);
    for (const cv of [this.still, this.liveCv]) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const place = placeFor(), now = new Date();
    this.route = routeKey();
    const yh = clamp(this.opts.horizon(H), H * 0.3, H), top = this.opts.top(H), floor = Math.max(top + 30, this.opts.floor(H));
    const k = Math.max(yh / 78, W / 200); // pixels per degree of sky
    const m = moonAt(now, place.lat, place.lng), up = m.alt > 0.5 * deg;
    // look towards the Moon (it sits a little right of centre), or towards the equator when it is down
    const A0 = up ? m.az / deg - (0.2 * W) / k : place.lat >= 0 ? 180 : 0;
    const toXY = (alt, az) => {
      let dx = az / deg - A0; dx -= 360 * Math.round(dx / 360);
      return [W / 2 + dx * k, yh - (alt / deg) * k];
    };

    // The Moon is always shown, like on a phone's lock screen, in tonight's real phase: where it really is
    // when it is up, and in a quiet spot high on the right when it is below the horizon.
    // (The street shows no Moon at all; Explore keeps it in the top corner, clear of its title.)
    const showMoon = !!this.moonEl;
    const md = Math.round(clamp(W * 0.034, 34, 50));
    let mx = -999, my = -999;
    if (showMoon) {
      [mx, my] = this.opts.corner ? [W - md / 2 - (W < 600 ? 22 : 56), top + md / 2 + 8]
        : up ? toXY(m.alt, m.az) : [W * (W < 600 ? 0.74 : 0.8), top + md / 2 + (floor - top) * 0.18];
      mx = clamp(mx, md / 2 + 8, W - md / 2 - 8);
      my = clamp(my, top + md / 2 + 4, floor - md / 2);
      // keep it out from under the page's buttons and title
      const base = this.el.getBoundingClientRect();
      const avoid = (this.opts.avoid?.() || []).map((r) => ({ l: r.left - base.left, t: r.top - base.top, r: r.right - base.left, b: r.bottom - base.top }));
      const hits = (x) => avoid.some((q) => x - md / 2 < q.r + 8 && x + md / 2 > q.l - 8 && my - md / 2 < q.b + 8 && my + md / 2 > q.t - 8);
      if (hits(mx)) {
        for (let d = 20; d < W; d += 20) {
          const c = [mx - d, mx + d].find((x) => x > md / 2 + 8 && x < W - md / 2 - 8 && !hits(x));
          if (c != null) { mx = c; break; }
        }
      }
    }
    const moonLight = up ? m.fraction * (0.4 + 0.6 * Math.min(1, Math.sin(m.alt) * 2)) : 0;
    const limit = 6.5 - 1.6 * moonLight - (small() ? 0.3 : 0);
    const dim = (x, y) => (showMoon ? 1 - (up ? 0.85 : 0.5) * m.fraction * Math.exp(-((x - mx) ** 2 + (y - my) ** 2) / (2 * (16 * k) ** 2)) : 1);

    // the still layer: the sky's colour, the Milky Way, the faint stars
    const g = this.still.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const lift = moonLight * 0.55;
    const mix = (a, b) => `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * lift)).join(',')})`;
    const sky = g.createLinearGradient(0, 0, 0, yh);
    sky.addColorStop(0, mix([3, 6, 20], [10, 20, 52]));
    sky.addColorStop(0.55, mix([9, 15, 44], [22, 36, 84]));
    sky.addColorStop(0.88, mix([24, 32, 78], [42, 58, 112]));
    sky.addColorStop(1, mix([58, 52, 98], [72, 76, 124]));
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // the glow of the city's lights on the horizon
    const haze = g.createLinearGradient(0, yh - Math.min(160, yh * 0.35), 0, H);
    haze.addColorStop(0, '#ff9a6000'); haze.addColorStop(0.7, '#ff9a6022'); haze.addColorStop(1, '#ffb27a33');
    g.fillStyle = haze; g.fillRect(0, 0, W, H);

    const proj = starProjector(now, place.lat, place.lng);
    g.globalCompositeOperation = 'lighter';
    const mw = 0.075 * (1 - 0.85 * moonLight);
    for (const b of MILKY) {
      const p = proj(b.ra, b.dec); if (p.alt < -3 * deg) continue;
      const [x, y] = toXY(p.alt, p.az), r = (b.r / deg) * k;
      if (x < -r || x > W + r || y < -r || y > yh + r) continue;
      g.globalAlpha = mw * b.w * smooth(-3, 12, p.alt / deg) * dim(x, y);
      g.drawImage(BLOB, x - r, y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
    this.live = [];
    const lowStar = (alt) => smooth(0, 9, alt / deg); // stars fade into the haze at the horizon
    for (const s of STARS) {
      if (s.m > limit) continue;
      const p = proj(s.ra, s.dec); if (p.alt < 0.5 * deg) continue;
      const [x, y] = toXY(p.alt, p.az);
      if (x < -20 || x > W + 20 || y < -20 || y > yh) continue;
      const fade = lowStar(p.alt) * dim(x, y);
      if (s.m < 4.6) {
        const low = 1 - Math.min(1, p.alt / deg / 40);
        this.live.push({
          x, y, c: s.c, size: clamp(4 + (4.6 - s.m) * 3.4, 4, 30), a: clamp(0.6 + (4.6 - s.m) * 0.13, 0.5, 1) * fade,
          f1: 0.6 + Math.random() * 1.6, f2: 1.3 + Math.random() * 2.4, p1: Math.random() * TAU, p2: Math.random() * TAU,
          amp: 0.18 + 0.5 * low, flash: s.m < 0.6 && p.alt < 25 * deg,
        });
      } else {
        g.globalAlpha = clamp((limit - s.m) / 1.6 + 0.1, 0.15, 0.95) * fade;
        g.fillStyle = COLOURS[s.c];
        const r = s.m < 5 ? 1 : s.m < 5.8 ? 0.8 : 0.62;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    }
    g.globalAlpha = 1;

    if (this.moonEl) this.moonEl.hidden = !showMoon;
    if (showMoon) {
      // moonlight scattered in the air close around it: a soft glow, stronger the fuller it is
      const glow = (up ? 1 : 0.7) * (0.15 + 0.85 * m.fraction), hr = md * (1.6 + 2.4 * m.fraction);
      const halo = g.createRadialGradient(mx, my, md * 0.45, mx, my, hr);
      halo.addColorStop(0, `rgba(222,228,250,${0.3 * glow})`); halo.addColorStop(0.3, `rgba(190,200,240,${0.08 * glow})`);
      halo.addColorStop(1, 'rgba(170,182,230,0)');
      g.fillStyle = halo; g.fillRect(mx - hr, my - hr, hr * 2, hr * 2);
      this.moonEl.style.cssText = `left:${mx - md / 2}px;top:${my - md / 2}px;width:${md}px;height:${md}px`;
      // a Moon below the horizon is drawn tilted the way it will sit when it rises
      let look = m;
      if (!up) { const c = nextMoonCrossing(now, place.lat, place.lng); if (c?.rising) look = moonAt(c.at, place.lat, place.lng); }
      if (MAP) paintMoon(this.moonCv, md, dpr, { ...m, limb: look.limb, north: look.north }, up ? m.alt : 30 * deg);
      else loadMap().then(() => { if (MAP) { this.layoutAt = 0; kick(); } });
    }

    this.W = W; this.H = H; this.dpr = dpr; this.yh = yh; this.k = k;
    this.layoutAt = performance.now();
    this.frame(performance.now(), true);
  }

  frame(t, still = reduced()) {
    const g = this.liveCv.getContext('2d'), s = t / 1000;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    for (const st of this.live) {
      const tw = still ? 1 : 1 - st.amp * (0.5 + 0.5 * Math.sin(s * st.f1 + st.p1)) * (0.5 + 0.5 * Math.sin(s * st.f2 + st.p2));
      g.globalAlpha = st.a * tw;
      // a bright star low in the sky flickers through colours (Sirius does this when it rises)
      const c = st.flash && !still ? Math.floor((s * 3 + st.p1) % 3) : st.c;
      g.drawImage(SPRITES[st.flash && !still ? [0, 1, 4][c] : c], st.x - st.size / 2, st.y - st.size / 2, st.size, st.size);
    }
    if (still) return;
    // now and then, a shooting star
    if (!this.meteor && t > this.meteorAt) {
      const ang = (20 + Math.random() * 40) * deg * (Math.random() < 0.5 ? 1 : -1);
      this.meteor = { t0: t, x: this.W * (0.15 + Math.random() * 0.7), y: this.yh * (0.08 + Math.random() * 0.35), dx: Math.cos(ang) * Math.sign(ang), dy: Math.abs(Math.sin(ang)), len: 120 + Math.random() * 160 };
    }
    if (this.meteor) {
      const mt = (t - this.meteor.t0) / 900;
      if (mt >= 1) { this.meteor = null; this.meteorAt = t + 14000 + Math.random() * 26000; return; }
      const { x, y, dx, dy, len } = this.meteor, head = mt * len * 1.6;
      const hx = x + dx * head, hy = y + dy * head, tx = hx - dx * len * 0.5, ty = hy - dy * len * 0.5;
      const gr = g.createLinearGradient(tx, ty, hx, hy);
      gr.addColorStop(0, '#ffffff00'); gr.addColorStop(1, '#ffffffdd');
      g.globalAlpha = Math.sin(mt * Math.PI); g.strokeStyle = gr; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
    }
    g.globalAlpha = 1;
  }
}

function tick(t) {
  raf = 0;
  let any = false;
  const step = small() ? 50 : 33, draw = t - lastDraw >= step;
  for (const sky of skies) {
    if (!sky.shown()) continue;
    any = true;
    // the stars move a quarter of a degree a minute: redraw the still layer once a minute
    if (!sky.layoutAt || t - sky.layoutAt > 60000 || sky.route !== routeKey()) sky.layout();
    else if (draw) sky.frame(t);
  }
  if (draw) lastDraw = t;
  if (any && !reduced()) raf = requestAnimationFrame(tick);
}
function kick() { if (!raf) raf = requestAnimationFrame(tick); }
// a page just opened: lay the skies out again once its title and buttons have settled, so the Moon
// keeps clear of them
let soon = 0;
function relayoutSoon() {
  kick();
  clearTimeout(soon);
  soon = setTimeout(() => { for (const s of skies) s.layoutAt = 0; kick(); }, 900);
}

// ---------- the three places a sky appears ----------
let made = false;
function makeSkies() {
  made = true;
  const street = document.getElementById('street'), city = document.getElementById('city'), explore = document.getElementById('explore');
  const coverOpen = () => (city && !city.hidden) || (explore && !explore.hidden);
  if (street) {
    const el = document.createElement('div');
    el.className = 'ns-street';
    street.prepend(el);
    let seen = true;
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; kick(); }).observe(street);
    // the street has the stars but no Moon
    new NightSky(el, { moon: false, horizon: (H) => H * 0.92, top: () => 12, floor: (H) => H * 0.36, when: () => seen && !coverOpen() });
  }
  if (city) {
    const el = document.createElement('div');
    el.className = 'ns-city';
    city.prepend(el);
    const parts = '.post-back, .post-night, .post-title, .skip';
    new NightSky(el, {
      horizon: (H) => H * 0.94, top: () => 74, floor: (H) => H * 0.75,
      avoid: () => [...city.querySelectorAll(parts), document.getElementById('skipBtn')].filter((e) => e && !e.hidden).map((e) => e.getBoundingClientRect()),
      when: () => !city.classList.contains('film-on'),
    });
    new MutationObserver(relayoutSoon).observe(city, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  if (explore) {
    const el = document.createElement('div');
    el.className = 'ns-explore';
    explore.after(el);
    // a page of maps and cards: the Moon keeps to the top corner, under the day/night switch and clear of the title
    new NightSky(el, {
      horizon: (H) => H, top: () => 58, floor: (H) => H * 0.8, corner: true,
      avoid: () => [...explore.querySelectorAll('.ex-title > *, .ex-tabs, .post-back, .post-night, .ex-tools')].map((e) => e.getBoundingClientRect()),
    });
    new MutationObserver(relayoutSoon).observe(explore, { attributes: true, attributeFilter: ['hidden'] });
  }
  document.addEventListener('visibilitychange', kick);
  document.fonts?.ready.then(relayoutSoon);
}

// called by night.js whenever night mode turns on or off
export function nightSky(on) {
  if (on && !made) makeSkies();
  // the place may have changed (a city opened), so start fresh
  for (const s of skies) s.layoutAt = 0;
  if (on) kick();
}
