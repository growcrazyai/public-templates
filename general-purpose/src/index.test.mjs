import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp, handler } from './index.mjs';

test('the server module exports a request handler', () => {
  assert.equal(typeof handler, 'function');
  assert.equal(handler.length, 2);
});

test('createApp builds a server without listening', () => {
  const server = createApp();
  assert.equal(server.listening, false);
  server.close();
});
