// Photo uploads for the editor page. The browser asks here for a signature, then sends the file
// straight to Cloudinary and gets back its https link, which is saved with the fact or event like any
// other photo link (with its credit). Only editors may upload.
import { json, err } from './router.js';
import { signParams, UPLOAD_FOLDER } from '../lib/cloudinary.js';

export default function uploads(r, { cloudinary }) {
  r.post('/api/admin/uploads/sign', { role: 'editor' }, async () => {
    if (!cloudinary) return err(503, 'Photo upload is not switched on yet: the site owner needs to add CLOUDINARY_URL on Vercel.');
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { folder: UPLOAD_FOLDER, timestamp };
    return json(200, { cloudName: cloudinary.cloudName, apiKey: cloudinary.apiKey, ...params,
      signature: signParams(params, cloudinary.apiSecret) });
  });
}
