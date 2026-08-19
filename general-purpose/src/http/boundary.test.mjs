import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createApp, readConfig } from '../index.mjs';
import { SECURITY_HEADERS } from './respond.mjs';

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

let server;
let origin;

before(async () => {
  server = createApp(readConfig({}));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

function rawGet(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const sent = httpRequest(`${origin}${path}`, { method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      );
    });
    sent.on('error', reject);
    sent.end();
  });
}

function assertSecurityHeaders(headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(headers[name], value, `header ${name}`);
  }
  assert.equal(headers['x-powered-by'], undefined);
}

test('the index document is served with every security header', async () => {
  const { status, headers, body } = await rawGet('/');
  assert.equal(status, 200);
  assert.equal(headers['content-type'], 'text/html; charset=utf-8');
  assertSecurityHeaders(headers);
  assert.match(body, /<html/);
});

test('the stylesheet is served with its declared type', async () => {
  const { status, headers } = await rawGet('/styles.css');
  assert.equal(status, 200);
  assert.equal(headers['content-type'], 'text/css; charset=utf-8');
  assertSecurityHeaders(headers);
});

test('an absent asset is a generic not-found with every security header', async () => {
  const { status, headers, body } = await rawGet('/no-such-asset.html');
  assert.equal(status, 404);
  assert.equal(body, 'not found');
  assertSecurityHeaders(headers);
});

test('an unrouted non-GET method is refused with every security header', async () => {
  const { status, headers, body } = await rawGet('/', 'POST');
  assert.equal(status, 405);
  assert.equal(body, 'method not allowed');
  assertSecurityHeaders(headers);
});

test('encoded traversal, null bytes, and malformed encoding are generic refusals, never crashes', async () => {
  for (const path of [
    '/%2e%2e/%2e%2e/etc/passwd',
    '/..%2fsecret',
    '/a%00b',
    '/%zz',
    '/a%5c..%5cb',
  ]) {
    const { status, body } = await rawGet(path);
    assert.equal(status, 404, `path ${path}`);
    assert.equal(body, 'not found', `path ${path}`);
  }
  const alive = await rawGet('/');
  assert.equal(alive.status, 200, 'the server survives hostile paths');
});

test('an extension outside the MIME allowlist is refused even when the file exists', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'gcai-mime-'));
  await writeFile(join(scratch, 'blob.xyz'), 'opaque');
  const scoped = createApp(Object.freeze({ port: 0, publicDir: scratch }));
  await new Promise((resolve) => scoped.listen(0, '127.0.0.1', resolve));
  try {
    const sent = await fetch(`http://127.0.0.1:${scoped.address().port}/blob.xyz`);
    assert.equal(sent.status, 404);
    assert.equal(await sent.text(), 'not found');
  } finally {
    scoped.close();
  }
});

test('a handler failure becomes a generic opaque 500 with every security header', async () => {
  const broken = createApp(Object.freeze({ port: 0, publicDir: 42 }));
  await new Promise((resolve) => broken.listen(0, '127.0.0.1', resolve));
  try {
    const sent = await fetch(`http://127.0.0.1:${broken.address().port}/`);
    assert.equal(sent.status, 500);
    assert.equal(await sent.text(), 'server failure');
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      assert.equal(sent.headers.get(name), value, `header ${name}`);
    }
  } finally {
    broken.close();
  }
});

test('the shipped index document is clean under the shipped content-security-policy', async () => {
  const document = await readFile(join(PUBLIC_DIR, 'index.html'), 'utf8');
  assert.doesNotMatch(document, /<style/i, 'no inline style element');
  assert.doesNotMatch(document, /\sstyle="/i, 'no inline style attribute');
  assert.doesNotMatch(document, /<script(?![^>]*\ssrc=)/i, 'no inline script');
  assert.match(document, /href="\/styles\.css"/, 'styles load from the external sheet');
});
