import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { MAX_BODY_BYTES, readBody } from './read-body.mjs';

test('a small body is collected into one buffer', async () => {
  const body = await readBody(Readable.from([Buffer.from('hel'), Buffer.from('lo')]));
  assert.equal(body.toString('utf8'), 'hello');
});

test('a body over the cap is refused', async () => {
  const oversized = Readable.from([Buffer.alloc(8), Buffer.alloc(8)]);
  await assert.rejects(() => readBody(oversized, 15), /body too large/);
});

test('the default cap is one mebibyte', () => {
  assert.equal(MAX_BODY_BYTES, 1_048_576);
});
