const assert = require('node:assert/strict');
const { test } = require('node:test');
const { unstable_dev } = require('wrangler');
const { createHash } = require('node:crypto');

// Run the real bundled Worker against a disposable local R2 binding. No account
// credentials, remote bindings, persistence, or deployment are used.
test('Wrangler serves authenticated image uploads from local R2', { timeout: 60000 }, async () => {
  const worker = await unstable_dev('src/index.ts', {
    config: 'wrangler.toml',
    local: true,
    persist: false,
    port: 0,
    ip: '127.0.0.1',
    vars: { TOKEN: 'local-integration-token' },
    r2: [{ binding: 'IMG_BUCKET', bucket_name: 'img-bucket', remote: false }],
    logLevel: 'error',
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true, forceLocal: true, watch: false }
  });
  try {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZsAAAAASUVORK5CYII=', 'base64');
    let response = await worker.fetch('/sample.png', { method: 'PUT', body: png, headers: { 'Content-Type': 'image/png' } });
    assert.equal(response.status, 401);
    response = await worker.fetch('/sample.png', { method: 'PUT', body: png, headers: { Authorization: 'local-integration-token', 'Content-Type': 'image/png' } });
    assert.equal(response.status, 201);
    const location = new URL(await response.text());
    const hash = createHash('sha1').update('sample.png').digest('hex');
    assert.equal(location.pathname, `/${hash}`);
    response = await worker.fetch(location.pathname);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.ok(response.headers.get('etag'));
    assert.match(response.headers.get('cache-control'), /^public, max-age=/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    response = await worker.fetch('/mismatch.jpg', { method: 'PUT', body: png, headers: { Authorization: 'local-integration-token', 'Content-Type': 'image/png' } });
    assert.equal(response.status, 400);
    response = await worker.fetch(`/${'0'.repeat(40)}`);
    assert.equal(response.status, 404);
    response = await worker.fetch('/not-a-hash');
    assert.equal(response.status, 400);
  } finally {
    await worker.stop();
  }
});

test('Miniflare uses patched sharp and can rasterize an SVG', async () => {
  const path = require('node:path');
  const miniflare = require.resolve('miniflare', { paths: [path.dirname(require.resolve('wrangler/package.json'))] });
  const sharpPath = require.resolve('sharp', { paths: [path.dirname(miniflare)] });
  const sharp = require(sharpPath);
  assert.equal(sharp.versions.sharp, '0.35.5');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="red"/></svg>');
  const output = await sharp(svg).png().toBuffer();
  assert.equal(output.subarray(1, 4).toString(), 'PNG');
  assert.equal((await sharp(output).metadata()).width, 8);
});
