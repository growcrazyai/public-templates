import assert from 'node:assert/strict';
import test from 'node:test';

import { SERVER_LIMITS, createApp, readConfig } from './index.mjs';

test('readConfig defaults the port and freezes the result', () => {
  const config = readConfig({});
  assert.equal(config.port, 3000);
  assert.equal(typeof config.publicDir, 'string');
  assert.equal(Object.isFrozen(config), true);
});

test('readConfig honours an explicit PORT', () => {
  assert.equal(readConfig({ PORT: '8080' }).port, 8080);
});

test('readConfig refuses a malformed PORT', () => {
  assert.throws(() => readConfig({ PORT: 'abc' }), /invalid PORT/);
  assert.throws(() => readConfig({ PORT: '70000' }), /invalid PORT/);
});

test('createApp builds an unlistening server with limits applied', () => {
  const server = createApp(readConfig({}));
  assert.equal(server.listening, false);
  assert.equal(server.headersTimeout, SERVER_LIMITS.headersTimeout);
  assert.equal(server.requestTimeout, SERVER_LIMITS.requestTimeout);
  assert.equal(server.keepAliveTimeout, SERVER_LIMITS.keepAliveTimeout);
  assert.equal(server.maxRequestsPerSocket, SERVER_LIMITS.maxRequestsPerSocket);
  server.close();
});
