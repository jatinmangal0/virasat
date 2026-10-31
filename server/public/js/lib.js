// Small helpers shared by the page's modules.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// A Cloudinary photo at the width it is shown, in the best format the browser takes (WebP or AVIF).
// Any other link (our own files, Wikimedia) is returned as it is.
export const fit = (src, w) => String(src || '').replace(/^(https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/)(?!f_auto)/, `$1f_auto,q_auto,c_limit,w_${w}/`);

// Every call to the server goes through here: GET without a body, POST with one. It never throws:
// the result is { ok, status, data }, and data.error explains what went wrong.
export async function api(path, body) {
  try {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach the server. Check your connection.' } };
  }
}
