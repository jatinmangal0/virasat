// The night sky's Moon (server/public/js/sky-astro.js): phase, place and tilt against known dates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moon, sun, galacticToEquatorial, nextMoonCrossing } from '../server/public/js/sky-astro.js';

const UDAIPUR = [24.5854, 73.7125];
const D = 180 / Math.PI;

test('new moon and full moon of April 2024 come out as new and full', () => {
  const nw = moon(new Date('2024-04-08T18:21Z'), ...UDAIPUR);
  assert.equal(nw.name, 'New moon');
  assert.ok(nw.fraction < 0.01);
  const full = moon(new Date('2024-04-23T23:49Z'), ...UDAIPUR);
  assert.equal(full.name, 'Full moon');
  assert.ok(full.fraction > 0.99);
});

test('an evening crescent in India lies on its back, lit side facing the set Sun below it', () => {
  const at = new Date('2024-04-11T14:00Z'); // 7:30 pm in Udaipur, three days after new moon
  const m = moon(at, ...UDAIPUR), s = sun(at, ...UDAIPUR);
  assert.equal(m.name, 'Waxing crescent');
  assert.ok(m.alt > 0 && s.alt < 0, 'the Moon is up and the Sun has set');
  // the lit side points down (180 degrees from straight up), within 25 degrees
  const limb = ((m.limb * D) % 360 + 360) % 360;
  assert.ok(Math.abs(limb - 180) < 25, `limb at ${limb.toFixed(1)} degrees`);
});

test('the Milky Way is centred in Sagittarius', () => {
  const c = galacticToEquatorial(0, 0);
  assert.ok(Math.abs(c.ra * D - 266.4) < 0.1 && Math.abs(c.dec * D + 28.94) < 0.1);
});

test('a Moon below the horizon has a rise time within a day', () => {
  const now = new Date('2026-11-04T16:10Z');
  assert.ok(moon(now, ...UDAIPUR).alt < 0);
  const next = nextMoonCrossing(now, ...UDAIPUR);
  assert.equal(next.rising, true);
  assert.ok(next.at > now && next.at - now < 24 * 3600e3);
});
