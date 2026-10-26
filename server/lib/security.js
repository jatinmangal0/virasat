import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltHex, keyHex] = stored.split('$');
  const key = scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export function safeEqualHex(a, b) {
  const x = Buffer.from(a, 'hex'), y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

// Accepts "98765 43210", "+91 98765-43210", "+1 415 555 0100". Bare 10-digit numbers are treated as Indian.
export function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  let e164;
  if (trimmed.startsWith('+')) e164 = '+' + digits;
  else if (digits.length === 10) e164 = '+91' + digits;
  else if (digits.length === 12 && digits.startsWith('91')) e164 = '+' + digits;
  else return null;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

export const isEmail = (s) => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Tiny fixed-window limiter, per key, in memory. Good enough for one process.
export function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, n: 1 });
      return true;
    }
    entry.n += 1;
    return entry.n <= max;
  };
}
