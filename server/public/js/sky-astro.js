// Where the Moon, the Sun and the stars are in the sky right now, for a place on Earth.
// Low-precision formulas (after Jean Meeus, "Astronomical Algorithms", in the compact form used by the
// suncalc library): good to a fraction of a degree, which is far finer than a screen can show.
// Everything is computed on the visitor's device; nothing is fetched.
//
// Angles in radians unless a name says Deg. Azimuth is measured from north through east (a compass).
const PI = Math.PI, rad = PI / 180, e = rad * 23.4397; // tilt of the Earth's axis
const J2000 = 2451545, DAY = 86400000;

const toDays = (date) => date.valueOf() / DAY - 0.5 + 2440588 - J2000;
const rightAscension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const declination = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
const siderealTime = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;

// a little lift near the horizon from the air bending the light
const refraction = (h) => { h = Math.max(h, 0); return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179)); };

function sunCoords(d) {
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + PI;
  return { ra: rightAscension(L, 0), dec: declination(L, 0) };
}

function moonCoords(d) {
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: 385001 - 20905 * Math.cos(M) };
}

// altitude, compass azimuth and parallactic angle of anything at (ra, dec), seen from (lat, lng) at day d
function horizontal(ra, dec, d, lat, lng) {
  const phi = rad * lat, H = siderealTime(d, rad * -lng) - ra;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const pa = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(dec) - Math.sin(dec) * Math.cos(H));
  return { alt, az: (azSouth + PI) % (2 * PI), pa };
}

const PHASES = [
  [0.0335, 'New moon'], [0.2165, 'Waxing crescent'], [0.2835, 'First quarter'], [0.4665, 'Waxing gibbous'],
  [0.5335, 'Full moon'], [0.7165, 'Waning gibbous'], [0.7835, 'Last quarter'], [0.9665, 'Waning crescent'], [1.01, 'New moon'],
];

// The Moon as seen from (lat, lng) at `date`:
//  alt, az       where it is (radians; az from north through east)
//  fraction      how much of the face is lit (0 to 1)
//  phase         0 new, .25 first quarter, .5 full, .75 last quarter
//  phaseAngle    Sun-Moon-Earth angle (0 at full, PI at new)
//  limb          which way the lit side faces on the sky, measured from straight up, anticlockwise (towards the
//                left), in radians: this is what tilts a crescent into a "smile" in India and a "C" in Europe
//  north         the same kind of angle for the Moon's own north, which turns its face (the dark seas) with it
export function moon(date, lat, lng) {
  const d = toDays(date), s = sunCoords(d), m = moonCoords(d), h = horizontal(m.ra, m.dec, d, lat, lng);
  const sdist = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  // position angle of the bright limb, from north through east
  const chi = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  const phase = 0.5 + 0.5 * inc * (chi < 0 ? -1 : 1) / PI;
  const alt = h.alt + refraction(h.alt);
  return {
    alt, az: h.az, fraction: (1 + Math.cos(inc)) / 2, phase, phaseAngle: inc,
    limb: chi - h.pa, north: -h.pa, name: PHASES.find(([t]) => phase < t)[1],
  };
}

export function sun(date, lat, lng) {
  const d = toDays(date), s = sunCoords(d);
  return horizontal(s.ra, s.dec, d, lat, lng);
}

// for many stars at once: the place and time part is worked out once
export function starProjector(date, lat, lng) {
  const d = toDays(date), lst = siderealTime(d, rad * -lng), phi = rad * lat;
  const sp = Math.sin(phi), cp = Math.cos(phi);
  return (ra, dec) => {
    const H = lst - ra, sd = Math.sin(dec), cd = Math.cos(dec), cH = Math.cos(H);
    const alt = Math.asin(sp * sd + cp * cd * cH);
    const az = Math.atan2(Math.sin(H), cH * sp - (sd / cd) * cp) + PI;
    return { alt, az };
  };
}

// The next time the Moon crosses the horizon (rising if it is down now, setting if it is up), searched in
// 10-minute steps and then halved down to a minute. Returns a Date, or null if it stays up or down all day.
export function nextMoonCrossing(date, lat, lng) {
  const up = (t) => moon(new Date(t), lat, lng).alt > -0.0145; // the Moon's upper edge, about -0.83 degrees
  const now = date.valueOf(), start = up(now), step = 10 * 60000;
  for (let t = now + step; t <= now + 26 * 3600000; t += step) {
    if (up(t) !== start) {
      let a = t - step, b = t;
      while (b - a > 60000) { const mid = (a + b) / 2; if (up(mid) === start) a = mid; else b = mid; }
      return { at: new Date(b), rising: !start };
    }
  }
  return null;
}

// Galactic plane (the Milky Way) to sky coordinates, for longitude l (radians) and latitude b.
// The north galactic pole is at RA 192.859 deg, Dec 27.128 deg; the galactic centre at l = 0.
const GP_RA = rad * 192.85948, GP_DEC = rad * 27.12825, L_NCP = rad * 122.93192;
export function galacticToEquatorial(l, b) {
  const sd = Math.sin(b) * Math.sin(GP_DEC) + Math.cos(b) * Math.cos(GP_DEC) * Math.cos(L_NCP - l);
  const dec = Math.asin(sd);
  const y = Math.cos(b) * Math.sin(L_NCP - l);
  const x = Math.sin(b) * Math.cos(GP_DEC) - Math.cos(b) * Math.sin(GP_DEC) * Math.cos(L_NCP - l);
  return { ra: (Math.atan2(y, x) + GP_RA + 2 * PI) % (2 * PI), dec };
}

export const deg = rad;
