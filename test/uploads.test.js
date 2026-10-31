// Photo uploads: the server signs Cloudinary uploads for editors only, and never hands out the secret.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';
import { parseCloudinaryUrl, cloudinaryFromEnv, signParams } from '../server/lib/cloudinary.js';

let t;
before(async () => { t = await startServer({ cloudinary: parseCloudinaryUrl('cloudinary://123456:s3cr3t@virasat-demo') }); });
after(async () => { await t?.stop(); });

test('the Cloudinary URL is read into its three parts, and anything else is ignored', () => {
  assert.deepEqual(parseCloudinaryUrl('cloudinary://123456:s3cr3t@virasat-demo'), { apiKey: '123456', apiSecret: 's3cr3t', cloudName: 'virasat-demo' });
  assert.equal(parseCloudinaryUrl(''), null);
  assert.equal(parseCloudinaryUrl('https://example.com'), null);
  const env = (o) => (k) => o[k];
  assert.deepEqual(cloudinaryFromEnv(env({ CLOUDINARY_CLOUD_NAME: 'virasat-demo', CLOUDINARY_API_KEY: '123456', CLOUDINARY_API_SECRET: 's3cr3t' })),
    { apiKey: '123456', apiSecret: 's3cr3t', cloudName: 'virasat-demo' });
  assert.equal(cloudinaryFromEnv(env({ CLOUDINARY_CLOUD_NAME: 'virasat-demo' })), null);
  assert.equal(cloudinaryFromEnv(env({ CLOUDINARY_URL: 'cloudinary://1:x@a', CLOUDINARY_CLOUD_NAME: 'b', CLOUDINARY_API_KEY: '2', CLOUDINARY_API_SECRET: 'y' })).cloudName, 'a');
});

test("signatures follow Cloudinary's rule (the example from its documentation)", () => {
  const sig = signParams({ eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 }, 'abcd');
  assert.equal(sig, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
});

test('only editors get an upload signature, and it never contains the secret', async () => {
  const learner = await t.person('Lina');
  assert.equal((await learner('/api/admin/uploads/sign', {})).status, 403);
  const editor = await t.person('Eshan', 'editor');
  const r = await editor('/api/admin/uploads/sign', {});
  assert.equal(r.status, 200);
  assert.equal(r.body.cloudName, 'virasat-demo');
  assert.equal(r.body.folder, 'virasat/uploads');
  assert.equal(r.body.signature, signParams({ folder: 'virasat/uploads', timestamp: r.body.timestamp }, 's3cr3t'));
  assert.ok(!JSON.stringify(r.body).includes('s3cr3t'));
});

test('without Cloudinary set up, upload says how to switch it on', async () => {
  const off = await startServer();
  const editor = await off.person('Esha', 'editor');
  const r = await editor('/api/admin/uploads/sign', {});
  assert.equal(r.status, 503);
  assert.match(r.body.error, /CLOUDINARY_URL/);
  await off.stop();
});

test('the deploy sync copies photos into Cloudinary once, keeps each original link, and leaves credits alone', async () => {
  const { sync } = await import('../scripts/cloudinary-sync.js');
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, opts) => {
    if (!String(url).startsWith('https://api.cloudinary.com/')) return realFetch(url, opts);
    calls++;
    const id = opts.body.get('public_id');
    return new Response(JSON.stringify({ secure_url: `https://res.cloudinary.com/virasat-demo/image/upload/v1/${id}` }), { status: 200 });
  };
  try {
    const cfg = parseCloudinaryUrl('cloudinary://123456:s3cr3t@virasat-demo');
    const before = (await t.db.query("SELECT id, image FROM facts WHERE image IS NOT NULL ORDER BY id LIMIT 1")).rows[0];
    const first = await sync(t.db, cfg, () => {});
    assert.ok(first.copied > 0);
    const f = (await t.db.query('SELECT image FROM facts WHERE id = $1', [before.id])).rows[0].image;
    assert.match(f.src, /^https:\/\/res\.cloudinary\.com\/virasat-demo\//);
    assert.equal(f.original, before.image.src);
    assert.equal(f.credit, before.image.credit);
    const k = (await t.db.query("SELECT stamp, poster FROM cities WHERE id = 'kolkata'")).rows[0];
    assert.match(k.stamp, /virasat\/site\/stamp-kolkata$/);
    assert.match(k.poster, /virasat\/site\/letter-kolkata$/);
    assert.match((await t.db.query("SELECT stamp FROM cities WHERE id = 'udaipur'")).rows[0].stamp, /virasat\/site\/stamp-udaipur$/);
    calls = 0;
    const second = await sync(t.db, cfg, () => {});
    assert.equal(second.copied, 0);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a photo too big for Cloudinary is copied from the 1920px Commons version instead', async () => {
  const { sync, commonsThumb } = await import('../scripts/cloudinary-sync.js');
  const big = 'https://upload.wikimedia.org/wikipedia/commons/2/20/Monsoon_Palace.jpg?utm_source=commons.wikimedia.org';
  assert.equal(commonsThumb(big), 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Monsoon_Palace.jpg/1920px-Monsoon_Palace.jpg');
  assert.equal(commonsThumb('https://example.com/a.jpg'), null);
  const id = (await t.db.query("SELECT id FROM facts ORDER BY id LIMIT 1")).rows[0].id;
  await t.db.query("UPDATE facts SET image = jsonb_build_object('src', $2::text, 'credit', 'Commons') WHERE id = $1", [id, big]);
  const realFetch = globalThis.fetch;
  const files = [];
  globalThis.fetch = async (url, opts) => {
    if (!String(url).startsWith('https://api.cloudinary.com/')) return realFetch(url, opts);
    const file = opts.body.get('file');
    files.push(file);
    if (file === big) return new Response(JSON.stringify({ error: { message: 'File size too large' } }), { status: 400 });
    return new Response(JSON.stringify({ secure_url: `https://res.cloudinary.com/virasat-demo/image/upload/v1/${opts.body.get('public_id')}` }), { status: 200 });
  };
  try {
    const r = await sync(t.db, parseCloudinaryUrl('cloudinary://123456:s3cr3t@virasat-demo'), () => {});
    assert.equal(r.failed, 0);
    assert.ok(files.includes(commonsThumb(big)));
    const f = (await t.db.query('SELECT image FROM facts WHERE id = $1', [id])).rows[0].image;
    assert.match(f.src, /^https:\/\/res\.cloudinary\.com\//);
    assert.equal(f.original, big);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('when Cloudinary cannot fetch a photo, the sync downloads it itself and uploads the bytes', async () => {
  const { sync } = await import('../scripts/cloudinary-sync.js');
  const blocked = 'https://upload.wikimedia.org/wikipedia/commons/0/03/Kolkata_Map_1690.jpg';
  const id = (await t.db.query("SELECT id FROM facts ORDER BY id OFFSET 1 LIMIT 1")).rows[0].id;
  await t.db.query("UPDATE facts SET image = jsonb_build_object('src', $2::text, 'credit', 'Commons') WHERE id = $1", [id, blocked]);
  const realFetch = globalThis.fetch;
  let agent = null;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith('https://upload.wikimedia.org/')) { agent = opts.headers?.['user-agent']; return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } }); }
    if (!u.startsWith('https://api.cloudinary.com/')) return realFetch(url, opts);
    const file = opts.body.get('file');
    if (!String(file).startsWith('data:')) return new Response(JSON.stringify({ error: { message: 'Error in loading remote resource' } }), { status: 400 });
    return new Response(JSON.stringify({ secure_url: `https://res.cloudinary.com/virasat-demo/image/upload/v1/${opts.body.get('public_id')}` }), { status: 200 });
  };
  try {
    const r = await sync(t.db, parseCloudinaryUrl('cloudinary://123456:s3cr3t@virasat-demo'), () => {});
    assert.equal(r.failed, 0);
    assert.match(agent, /VirasatBot/);
    const f = (await t.db.query('SELECT image FROM facts WHERE id = $1', [id])).rows[0].image;
    assert.match(f.src, /^https:\/\/res\.cloudinary\.com\//);
    assert.equal(f.original, blocked);
  } finally {
    globalThis.fetch = realFetch;
  }
});
