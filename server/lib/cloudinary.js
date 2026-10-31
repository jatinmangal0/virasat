// Cloudinary keeps Virasat's image files; the database keeps only their links (and each photo's credit).
//   CLOUDINARY_URL=cloudinary://<api key>:<api secret>@<cloud name>   (set on Vercel, never in git)
//   or the three parts separately: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// Editors upload straight from the browser to Cloudinary with a short-lived signature from our server,
// so the secret never leaves the server and big files never pass through a Vercel function.
import { createHash } from 'node:crypto';

export function parseCloudinaryUrl(url = '') {
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@([\w-]+)$/.exec(String(url).trim());
  return m ? { apiKey: m[1], apiSecret: m[2], cloudName: m[3] } : null;
}

// Reads either form from the environment; CLOUDINARY_URL wins when both are set.
export function cloudinaryFromEnv(get = (k) => process.env[k]) {
  const fromUrl = parseCloudinaryUrl(get('CLOUDINARY_URL') || '');
  if (fromUrl) return fromUrl;
  const [cloudName, apiKey, apiSecret] = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
    .map((k) => String(get(k) || '').trim());
  return cloudName && apiKey && apiSecret && /^[\w-]+$/.test(cloudName) ? { apiKey, apiSecret, cloudName } : null;
}

// Cloudinary's signature: the parameters sorted by name as a=1&b=2, the secret appended, SHA-1 in hex.
// (file, api_key, cloud_name and resource_type are never signed.)
export function signParams(params, apiSecret) {
  const s = Object.keys(params).filter((k) => params[k] !== undefined && params[k] !== '').sort()
    .map((k) => `${k}=${params[k]}`).join('&');
  return createHash('sha1').update(s + apiSecret).digest('hex');
}

export const UPLOAD_FOLDER = 'virasat/uploads';

// Upload from the server (the build's sync script): a local file as a data: URI, or a remote https link
// that Cloudinary fetches itself. With overwrite off, the same public_id answers with the copy it already has.
export async function upload(cfg, file, publicId) {
  const params = { overwrite: 'false', public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append('file', file);
  form.append('api_key', cfg.apiKey);
  form.append('signature', signParams(params, cfg.apiSecret));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) throw new Error(data.error?.message || `Cloudinary answered ${res.status}`);
  return data.secure_url;
}
