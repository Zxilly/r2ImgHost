const assert = require('node:assert/strict');
const { test } = require('node:test');
const { default: worker } = require('../src/index.ts');

const context = {};
const unusedBucket = {
  get() { throw new Error('Unexpected R2 read'); },
  put() { throw new Error('Unexpected R2 write'); }
};
const env = { IMG_BUCKET: unusedBucket, TOKEN: 'test-token' };

// Bound the entry-point call so the thenable returned by router.handle in v5
// fails explicitly instead of leaving the test process waiting indefinitely.
async function fetch(request, bindings = env) {
  let timer;
  try {
    return await Promise.race([
      worker.fetch(request, bindings, context),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Worker fetch did not settle')), 1000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test('the Worker entry point redirects the home page', async () => {
  const response = await fetch(new Request('https://images.example/'));
  assert.ok(response instanceof Response);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), 'https://github.com/Zxilly/r2ImgHost');
});

test('the Worker entry point returns the fallback for an unknown route', async () => {
  const response = await fetch(new Request('https://images.example/not/a/route'));
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Not Found');
});

test('the Worker entry point enforces PUT authorization before accessing R2', async () => {
  const response = await fetch(new Request('https://images.example/photo.png', { method: 'PUT' }));
  assert.equal(response.status, 401);
  assert.equal(await response.text(), 'Unauthorized');
});

test('the Worker entry point passes bindings to the R2 image handler', async () => {
  const hash = '0123456789abcdef0123456789abcdef01234567';
  const reads = [];
  const response = await fetch(new Request(`https://images.example/${hash}`), {
    ...env,
    IMG_BUCKET: {
      async get(key) {
        reads.push(key);
        return {
          body: 'image bytes',
          uploaded: new Date(0),
          httpEtag: '"image-etag"',
          writeHttpMetadata(headers) { headers.set('Content-Type', 'image/png'); }
        };
      },
      put: unusedBucket.put
    }
  });
  assert.deepEqual(reads, [hash]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal(response.headers.get('etag'), '"image-etag"');
  assert.equal(await response.text(), 'image bytes');
});

test('the Worker entry point returns 404 for a missing R2 image', async () => {
  const response = await fetch(new Request(`https://images.example/${'a'.repeat(40)}`), {
    ...env,
    IMG_BUCKET: { async get() { return null; }, put: unusedBucket.put }
  });
  assert.equal(response.status, 404);
});
