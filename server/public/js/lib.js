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

// A Cloudinary link with any size/format steps it already carries taken off, so we can add our own.
const CLOUD = /^(https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/)((?:[a-z]{1,3}_[^/]*\/)*)/;

// A small square (or w x h) thumbnail that Cloudinary crops around what matters in the picture
// (faces, people, the building), not blindly from the middle. Other links are returned as they are
// and the CSS shows them from a little above centre, where faces usually are.
export const smart = (src, w, h = w) => String(src || '').replace(CLOUD, `$1f_auto,q_auto,c_fill,g_auto,w_${w},h_${h}/`);

// Photos are never cut to fit their frame: the whole picture is shown (CSS object-fit: contain), and
// the empty edges are filled with a soft, blurred copy of the same photo, like a mount behind a print.
// Any <img> matching WHOLE gets that backdrop, whenever it appears or changes its picture.
const WHOLE = '.snap:not(.stamp) img, .pc-photo img, .postcard img, .card-photo img, .kit-photos img, .fc-art img, .pic-frame img, .mem-face img, .thumbs img';
const blurred = (src) => (CLOUD.test(src) ? src.replace(CLOUD, '$1f_auto,q_30,c_limit,w_80,e_blur:600/') : '');
function mount(img) {
  const src = img.currentSrc || img.getAttribute('src') || '';
  if (img.dataset.mount === src) return;
  img.dataset.mount = src;
  const soft = blurred(src);
  img.style.backgroundImage = soft ? `url("${soft}")` : '';
}
function mountAll(root) {
  if (root.matches?.(WHOLE)) mount(root);
  root.querySelectorAll?.(WHOLE).forEach(mount);
}
if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const start = () => {
    mountAll(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'attributes') { if (m.target.matches(WHOLE)) mount(m.target); }
        else m.addedNodes.forEach((n) => n.nodeType === 1 && mountAll(n));
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
}

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
